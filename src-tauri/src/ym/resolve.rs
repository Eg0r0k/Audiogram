//! From a track id to a playable URL: `download-info` names the encodings,
//! its XML link carries the pieces of a signed path, and the signature is an
//! MD5 over a fixed salt. The result lives about a minute upstream, so it is
//! cached for less than that and resolved again on a 410.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use md5::{Digest, Md5};

use super::api::{YmError, YmErrorKind};
use super::state::{YmSession, CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE};

/// Yandex's link salt — the same one every client uses.
const SIGN_SALT: &str = "XGRlBW9FXlekgbPrRHuSiA";

/// The XML link is good for about a minute upstream; a cached entry must be
/// gone before the link is, or a seek would replay a dead URL.
pub const LINK_TTL: Duration = Duration::from_secs(45);

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadInfo {
    pub codec: String,
    #[serde(default)]
    pub bitrate_in_kbps: u32,
    /// True without a subscription: a 30-second cut of the track.
    #[serde(default)]
    pub preview: bool,
    pub download_info_url: String,
}

/// A playable link and what it plays.
#[derive(Debug, Clone)]
pub struct ResolvedTrack {
    pub url: String,
    pub preview: bool,
    pub codec: String,
    pub bitrate: u32,
}

/// The highest-bitrate mp3 — the only codec v1 plays (no lossless, no aac).
pub fn pick_best(infos: &[DownloadInfo]) -> Option<&DownloadInfo> {
    infos
        .iter()
        .filter(|info| info.codec == "mp3")
        .max_by_key(|info| info.bitrate_in_kbps)
}

#[derive(Debug, PartialEq, Eq)]
pub struct XmlInfo {
    pub host: String,
    pub path: String,
    pub ts: String,
    pub s: String,
}

fn xml_tag<'a>(xml: &'a str, tag: &str) -> Option<&'a str> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    Some(&xml[start..end])
}

/// The four pieces of the signed path out of `<download-info>…</download-info>`.
pub fn parse_download_xml(xml: &str) -> Result<XmlInfo, String> {
    let field = |tag: &str| {
        xml_tag(xml, tag)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .ok_or_else(|| format!("download-info xml: missing <{tag}>"))
    };
    Ok(XmlInfo {
        host: field("host")?,
        path: field("path")?,
        ts: field("ts")?,
        s: field("s")?,
    })
}

/// `{scheme}://{host}/get-mp3/{md5(salt + path[1..] + s)}/{ts}{path}`.
pub fn signed_url(info: &XmlInfo, scheme: &str) -> String {
    let path_tail = info.path.strip_prefix('/').unwrap_or(&info.path);
    let sign = hex::encode(Md5::digest(format!("{SIGN_SALT}{path_tail}{}", info.s)));
    format!(
        "{scheme}://{}/get-mp3/{sign}/{}{}",
        info.host, info.ts, info.path
    )
}

async fn text_of(resp: reqwest::Response) -> Result<(u16, String), YmError> {
    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    Ok((status, body))
}

/// Both round-trips to Yandex. `link_scheme` is `https` in production and
/// whatever the test upstream speaks.
pub async fn resolve(
    client: &reqwest::Client,
    api_base: &str,
    link_scheme: &str,
    session: &YmSession,
    track_id: &str,
) -> Result<ResolvedTrack, YmError> {
    let resp = client
        .get(format!("{api_base}/tracks/{track_id}/download-info"))
        .header(reqwest::header::AUTHORIZATION, session.authorization())
        .header(CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE)
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let (status, body) = text_of(resp).await?;
    if status != 200 {
        return Err(YmError::from_status(status, &body, None));
    }
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| YmError::unknown(format!("download-info: {e}")))?;
    let infos: Vec<DownloadInfo> = serde_json::from_value(json["result"].clone())
        .map_err(|e| YmError::unknown(format!("download-info: {e}")))?;
    let Some(best) = pick_best(&infos) else {
        return Err(YmError::new(
            YmErrorKind::Unavailable,
            "no mp3 encoding offered",
        ));
    };

    let resp = client
        .get(&best.download_info_url)
        .header(CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE)
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let (status, xml) = text_of(resp).await?;
    if status != 200 {
        return Err(YmError::from_status(status, "", None));
    }
    let info = parse_download_xml(&xml).map_err(YmError::unknown)?;
    Ok(ResolvedTrack {
        url: signed_url(&info, link_scheme),
        preview: best.preview,
        codec: best.codec.clone(),
        bitrate: best.bitrate_in_kbps,
    })
}

/// Resolved links by track id with the moment they were resolved.
#[derive(Default)]
pub struct YmLinkCache(Mutex<HashMap<String, (ResolvedTrack, Instant)>>);

impl YmLinkCache {
    pub fn get(&self, track_id: &str) -> Option<ResolvedTrack> {
        self.get_at(track_id, Instant::now())
    }

    pub fn get_at(&self, track_id: &str, now: Instant) -> Option<ResolvedTrack> {
        let map = self.0.lock().ok()?;
        let (link, resolved_at) = map.get(track_id)?;
        (now.duration_since(*resolved_at) < LINK_TTL).then(|| link.clone())
    }

    pub fn insert(&self, track_id: &str, link: ResolvedTrack) {
        self.insert_at(track_id, link, Instant::now());
    }

    pub fn insert_at(&self, track_id: &str, link: ResolvedTrack, now: Instant) {
        if let Ok(mut map) = self.0.lock() {
            map.insert(track_id.to_owned(), (link, now));
        }
    }

    /// A 410 from the link host: the link is dead whatever the clock says.
    pub fn invalidate(&self, track_id: &str) {
        if let Ok(mut map) = self.0.lock() {
            map.remove(track_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use http_body_util::Full;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    fn info(codec: &str, bitrate: u32, preview: bool) -> DownloadInfo {
        DownloadInfo {
            codec: codec.into(),
            bitrate_in_kbps: bitrate,
            preview,
            download_info_url: format!("https://api.example/get-{codec}/{bitrate}"),
        }
    }

    #[test]
    fn picks_the_highest_mp3_bitrate_and_ignores_other_codecs() {
        let infos = [
            info("aac", 256, false),
            info("mp3", 128, false),
            info("mp3", 320, false),
            info("mp3", 192, false),
        ];

        let best = pick_best(&infos).expect("an mp3");

        assert_eq!(best.bitrate_in_kbps, 320);
        assert!(pick_best(&[info("aac", 256, false)]).is_none());
        assert!(pick_best(&[]).is_none());
    }

    // Recorded 2026-09-15 for a preview of track 40144 (see the plan's spike).
    const RECORDED_XML: &str = "<download-info><host>api.music.yandex.net</host><path>/U2FsdGVkX1-W9sGRpxFF5GuhXHZyXwTwfbklFTqWIibNA9sjTnPaiVXCgn9APh8ACLvAiCcHIWP-0Gc0Lm-YW5sZ39mxPIMBaGqRH4I8GJuIPngK8jKinsuS8sClPcwhB-3zYYXowyxS555q-KQiJ9IC8-wRuXT9dspb0cTs5zuy-F2U93Y5QiDqKVmu5stRBVq8fD6NIj6ey4nQdcULFE_Nrkni753IE09YDeTzHFrTTwK9izfKXYXzJ7vt4pL-zV02mVmNG_WE1x-jNjAvADRUVZor6NZ3Aqgo8Y1u01BwmYIrvdqSMkPQdNPyzDONrAybPwqlHyXZVTW18W8rMq2lAP1H0uz6UU9167g3WaDksHT7vZpQZpREZn1_P4Epaa5X_-ntd1ov6u_QD3Fn9wWA13lK-PVT87RUsHRLA2SybQaCK86yAA03I6bcTdNYBrzAYk1pq__pFqAhNY0vxDLStsnY0MWXKlfnWy3fDtR854N5sUU1Fr7BrFTy8KH1TR-q13aHyAUER64iFO-zrMQZH6lW3Ur5SPxMnQZs0KbR04r55QlvBzaUMpfVL4spbRkXeJ6ldISu6tBiookt7V8crXnWZp1o6wo3k-kmoPYz9hlFM5AkPpvR3mDp0VczdQIrXS7jPYbcJ3ACWB1voWRC9DV2zjFw38H8euWh9phmbtxudjZmH2Ok6LUi7zrKbUT2fm32KAIN-3-SdsVhuBgoMA9FUV0VDm7lMzYUkCdEN7lI-qokauSM5ShjyNK9bm6E1-4KLeCJyo-AdMEWtK0bsM6LZVNroIgdC3qiyPf7citHg_VT20jZOpxtkJ9BlodP6hDbIHpvCiHyt0uIlKiPK1JAAz8uyDfTgwUfIYeMUmhTeKe71gsc0HIV1Y7m1AInDYWNl50tUP0vDLbN-xfeVqAWL91LmTZymakKUdM19d8pLnKmDnUrdJC-L7H47gqoIUQ5LG0GUV-Pc6HFnw/tljhWMj8KVveZ-aTo-faB5Zste5mbL9Gjy6UW36yBF0</path><ts>1a0a6024671</ts><region>-1</region><s>tljhWMj8KVveZ-aTo-faB5Zste5mbL9Gjy6UW36yBF0</s></download-info>";

    #[test]
    fn the_signed_url_matches_the_link_yandex_accepted_for_the_recorded_xml() {
        let info = parse_download_xml(RECORDED_XML).expect("xml");

        let url = signed_url(&info, "https");

        // The signature Yandex answered 308 → 206 for during the spike.
        assert!(url.starts_with(
            "https://api.music.yandex.net/get-mp3/5cdea24f758b76840bdb25e1c1ee19bd/1a0a6024671/U2FsdGVkX1-"
        ));
        assert!(url.ends_with("/tljhWMj8KVveZ-aTo-faB5Zste5mbL9Gjy6UW36yBF0"));
    }

    #[test]
    fn the_xml_parser_needs_every_piece() {
        assert!(parse_download_xml(
            "<download-info><host>h</host><path>/p</path><ts>1</ts></download-info>"
        )
        .is_err());
        assert!(parse_download_xml(
            "<download-info><host></host><path>/p</path><ts>1</ts><s>s</s></download-info>"
        )
        .is_err());
        assert!(parse_download_xml("not xml").is_err());
        assert_eq!(
            parse_download_xml(
                "<download-info><host>h</host><path>/p</path><ts>1</ts><s>s</s></download-info>"
            ),
            Ok(XmlInfo {
                host: "h".into(),
                path: "/p".into(),
                ts: "1".into(),
                s: "s".into()
            })
        );
    }

    #[test]
    fn the_cache_forgets_a_link_before_the_upstream_does() {
        let cache = YmLinkCache::default();
        let link = ResolvedTrack {
            url: "u".into(),
            preview: false,
            codec: "mp3".into(),
            bitrate: 320,
        };
        let t0 = Instant::now();
        cache.insert_at("1", link, t0);

        assert!(cache.get_at("1", t0 + Duration::from_secs(44)).is_some());
        assert!(cache.get_at("1", t0 + Duration::from_secs(46)).is_none());
        assert!(cache.get_at("2", t0).is_none());

        cache.insert_at(
            "1",
            ResolvedTrack {
                url: "u2".into(),
                preview: false,
                codec: "mp3".into(),
                bitrate: 320,
            },
            t0,
        );
        cache.invalidate("1");
        assert!(cache.get_at("1", t0).is_none());
    }

    fn session() -> YmSession {
        YmSession::new(42, true, "Tester", "tok-1", None, None)
    }

    #[tokio::test]
    async fn resolving_walks_download_info_then_the_xml_and_signs_the_path() {
        let hits = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&hits);
        // The XML link and the signed link both point back at this upstream.
        let upstream_holder: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let holder = Arc::clone(&upstream_holder);
        let upstream = spawn_upstream(move |req| {
            seen.fetch_add(1, Ordering::SeqCst);
            let base = holder.lock().expect("base").clone();
            match req.uri().path() {
                "/tracks/40144/download-info" => {
                    assert_eq!(req.headers()["Authorization"], "OAuth tok-1");
                    let body = format!(
                        r#"{{"result":[{{"codec":"aac","bitrateInKbps":256,"preview":false,"downloadInfoUrl":"{base}/aac"}},{{"codec":"mp3","bitrateInKbps":192,"preview":false,"downloadInfoUrl":"{base}/mp3-192"}},{{"codec":"mp3","bitrateInKbps":320,"preview":false,"downloadInfoUrl":"{base}/mp3-320"}}]}}"#
                    );
                    http::Response::builder().status(200).body(Full::new(bytes::Bytes::from(body))).unwrap()
                }
                "/mp3-320" => {
                    let host = base.trim_start_matches("http://").to_owned();
                    let body = format!("<download-info><host>{host}</host><path>/p/x.mp3</path><ts>1a0</ts><region>-1</region><s>sig</s></download-info>");
                    http::Response::builder().status(200).body(Full::new(bytes::Bytes::from(body))).unwrap()
                }
                other => panic!("unexpected request to {other}"),
            }
        })
        .await;
        *upstream_holder.lock().expect("base") = upstream.clone();

        let resolved = resolve(
            &reqwest::Client::new(),
            &upstream,
            "http",
            &session(),
            "40144",
        )
        .await
        .expect("resolved");

        let expected_sign = hex::encode(Md5::digest(format!("{SIGN_SALT}p/x.mp3sig")));
        assert_eq!(
            resolved.url,
            format!("{upstream}/get-mp3/{expected_sign}/1a0/p/x.mp3")
        );
        assert_eq!(resolved.bitrate, 320);
        assert!(!resolved.preview);
        assert_eq!(hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn a_403_on_download_info_is_forbidden_and_a_401_is_auth() {
        for (status, kind) in [(403, YmErrorKind::Forbidden), (401, YmErrorKind::Auth)] {
            let upstream = spawn_upstream(move |_req| {
                http::Response::builder()
                    .status(status)
                    .body(Full::new(bytes::Bytes::new()))
                    .unwrap()
            })
            .await;

            let error = resolve(&reqwest::Client::new(), &upstream, "http", &session(), "1")
                .await
                .unwrap_err();

            assert_eq!(error.kind, kind);
        }
    }

    #[tokio::test]
    async fn a_download_info_without_an_mp3_is_unavailable() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(200)
                .body(Full::new(bytes::Bytes::from_static(
                    br#"{"result":[{"codec":"aac","bitrateInKbps":256,"preview":false,"downloadInfoUrl":"x"}]}"#,
                )))
                .unwrap()
        })
        .await;

        let error = resolve(&reqwest::Client::new(), &upstream, "http", &session(), "1")
            .await
            .unwrap_err();

        assert_eq!(error.kind, YmErrorKind::Unavailable);
    }
}
