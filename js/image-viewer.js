/* image-viewer.js — image compression + reference/topic image viewer */
(function () {
  'use strict';

  /* ------------------------------------------------------------
     compressImage(file, maxWidth, maxHeight, quality) → Promise<File>
     ------------------------------------------------------------ */
  window.compressImage = function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise(function (resolve, reject) {
      try {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            var width = img.width;
            var height = img.height;
            if (width > maxWidth || height > maxHeight) {
              var ratio = Math.min(maxWidth / width, maxHeight / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(function (blob) {
              if (!blob) { reject(new Error('Image compression failed')); return; }
              resolve(new File([blob], file.name || 'capture.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', quality);
          };
          img.onerror = function () { reject(new Error('Could not read image')); };
          img.src = e.target.result;
        };
        reader.onerror = function () { reject(reader.error || new Error('File read failed')); };
        reader.readAsDataURL(file);
      } catch (err) { reject(err); }
    });
  };

  /* ------------------------------------------------------------
     imageViewer — modal gallery for reference images
     ------------------------------------------------------------ */
  var imageViewer = {
    images: [],
    scale: 1,

    open: function (images, title) {
      this.images = Array.isArray(images) ? images.slice() : [];
      this.scale = 1;
      var modal = document.getElementById('image-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      var titleEl = document.getElementById('image-modal-title');
      var countEl = document.getElementById('image-count');
      if (titleEl) titleEl.textContent = title || 'Images';
      if (countEl) countEl.textContent = this.images.length + (this.images.length === 1 ? ' image' : ' images');
      var viewer = document.getElementById('image-viewer-container');
      var gallery = document.getElementById('image-gallery');
      var empty = document.getElementById('no-images-message');
      if (!this.images.length) {
        if (gallery) { gallery.innerHTML = ''; gallery.classList.add('hidden'); }
        if (viewer) viewer.classList.remove('hidden');
        if (empty) empty.classList.remove('hidden');
      } else {
        if (empty) empty.classList.add('hidden');
        if (gallery) gallery.classList.remove('hidden');
        if (viewer) viewer.classList.remove('hidden');
        this.renderGallery();
      }
    },

    renderGallery: function () {
      var gallery = document.getElementById('image-gallery');
      if (!gallery) return;
      var self = this;
      gallery.innerHTML = this.images.map(function (img, i) {
        return '<div class="image-item" data-index="' + i + '">' +
          '<img src="' + img.data + '" alt="' + (img.filename || 'image') + '">' +
          '<div class="filename">' + (img.filename || ('image-' + (i + 1))) + '</div>' +
          '</div>';
      }).join('');
      gallery.querySelectorAll('.image-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var idx = parseInt(el.getAttribute('data-index'), 10);
          self.viewFullSize(self.images[idx] ? self.images[idx].data : null);
        });
      });
      this.applyScale();
    },

    viewFullSize: function (data) {
      if (!data) return;
      var overlay = document.createElement('div');
      overlay.className = 'image-item-fullscreen';
      overlay.innerHTML = '<img class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" src="' + data + '" alt="Full size image">';
      overlay.addEventListener('click', function () { overlay.remove(); });
      document.body.appendChild(overlay);
    },

    applyScale: function () {
      document.querySelectorAll('#image-gallery .image-item img').forEach(function (img) {
        img.style.transform = 'scale(' + imageViewer.scale + ')';
        img.style.transformOrigin = 'center';
      });
    },

    zoomIn: function () {
      this.scale = Math.min(3, this.scale + 0.2);
      this.applyScale();
    },

    zoomOut: function () {
      this.scale = Math.max(0.3, this.scale - 0.2);
      this.applyScale();
    },

    downloadAll: function () {
      if (!this.images.length) return;
      this.images.forEach(function (img, i) {
        var a = document.createElement('a');
        a.href = img.data;
        a.download = img.filename || ('image-' + (i + 1) + '.jpg');
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    },

    close: function () {
      var modal = document.getElementById('image-modal');
      if (modal) modal.classList.add('hidden');
      this.images = [];
      var gallery = document.getElementById('image-gallery');
      if (gallery) gallery.innerHTML = '';
    },

    init: function () { /* reserved for future admin upload */ }
  };

  window.imageViewer = imageViewer;
})();
