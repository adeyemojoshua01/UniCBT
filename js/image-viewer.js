/* ==========================================================================
   image-viewer.js — compressImage() helper + imageViewer gallery object
   ========================================================================== */

/**
 * Compress / resize an image File.
 * Returns Promise<File> (JPEG) — aspect ratio preserved, never upscaled.
 */
function compressImage(file, maxWidth, maxHeight, quality) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onerror = function () { reject(new Error('Could not read the image file.')); };
    reader.onload = function (e) {
      var img = new Image();
      img.onerror = function () { reject(new Error('The selected file is not a valid image.')); };
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        var ratio = Math.min(maxWidth / w, maxHeight / h, 1);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('Image compression failed.')); return; }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
window.compressImage = compressImage;

var imageViewer = {
  images: [],
  scale: 1,

  open: function (images, title) {
    this.images = Array.isArray(images) ? images : [];
    this.scale = 1;
    var modal = document.getElementById('image-modal');
    var titleEl = document.getElementById('image-modal-title');
    var countEl = document.getElementById('image-count');
    var viewer = document.getElementById('image-viewer-container');
    var empty = document.getElementById('no-images-message');
    if (!modal) return;
    if (titleEl) titleEl.textContent = title || 'Reference Images';
    if (countEl) countEl.textContent = this.images.length + (this.images.length === 1 ? ' image' : ' images');
    if (this.images.length === 0) {
      if (viewer) viewer.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
    } else {
      if (viewer) viewer.classList.remove('hidden');
      if (empty) empty.classList.add('hidden');
      this.renderGallery();
    }
    modal.classList.remove('hidden');
  },

  renderGallery: function () {
    var gallery = document.getElementById('image-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    var self = this;
    this.images.forEach(function (img) {
      var item = document.createElement('div');
      item.className = 'image-item';
      var el = document.createElement('img');
      el.src = img.data;
      el.alt = img.filename || 'image';
      var name = document.createElement('div');
      name.className = 'filename';
      name.textContent = img.filename || '';
      item.appendChild(el);
      item.appendChild(name);
      item.addEventListener('click', function () { self.viewFullSize(img.data); });
      gallery.appendChild(item);
    });
  },

  viewFullSize: function (data) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    var img = document.createElement('img');
    img.src = data;
    img.className = 'max-h-[90vh] max-w-[90vw] object-contain';
    overlay.appendChild(img);
    overlay.addEventListener('click', function () { overlay.remove(); });
    document.body.appendChild(overlay);
  },

  zoomIn: function () { this.scale = Math.min(3, this.scale + 0.25); this._applyZoom(); },
  zoomOut: function () { this.scale = Math.max(0.3, this.scale - 0.25); this._applyZoom(); },
  _applyZoom: function () {
    var s = this.scale;
    document.querySelectorAll('#image-modal .image-item img').forEach(function (el) {
      el.style.transform = 'scale(' + s + ')';
    });
  },

  downloadAll: function () {
    this.images.forEach(function (img, i) {
      setTimeout(function () {
        var a = document.createElement('a');
        a.href = img.data;
        a.download = img.filename || ('image-' + (i + 1) + '.jpg');
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 250);
    });
  },

  close: function () {
    var modal = document.getElementById('image-modal');
    if (modal) modal.classList.add('hidden');
    this.images = [];
    this.scale = 1;
    var gallery = document.getElementById('image-gallery');
    if (gallery) gallery.innerHTML = '';
  },

  init: function () { /* no-op — reserved for future admin upload */ }
};
window.imageViewer = imageViewer;
