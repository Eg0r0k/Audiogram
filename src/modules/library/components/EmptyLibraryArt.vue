<template>
  <div class="empty-library-art">
    <div class="cover cover-left" />
    <div class="cover cover-right" />
    <div class="cover cover-center" />
  </div>
</template>

<style scoped>
.empty-library-art {
  position: relative;
  aspect-ratio: 240 / 152;
}

.cover {
  position: absolute;
  top: 17%;
  left: 30%;
  width: 40%;
  aspect-ratio: 1;
  border-radius: 18%;
}

.cover-left {
  background:linear-gradient(90deg, #d53369 0%, #daae51 100%);
  transform: translate(-50.5%, 10.5%) rotate(-14deg) scale(0.9);
}

.cover-right {
  background: linear-gradient(90deg, #00d2ff 0%, #3a47d5 100%);
  transform: translate(50.5%, 10.5%) rotate(14deg) scale(0.9);
}

.cover-center {
  background: linear-gradient(90deg, #efd5ff 0%, #515ada 100%);
}

</style>
