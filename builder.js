(() => {
  'use strict';

  const traitRoot = 'Flamingos';
  const categories = [
    {
      key: 'Background', label: 'Background', files: [
        'Starry Dream.png', 'Aqua Flow.png', 'Neon Arcade.png', 'Full Court.png', 'Soft Beige.png', 'Mono Grid.png', 'Electric Blue.png', 'Blue Matrix.png', 'Twin Towers.png', 'Lava Cave.png', 'Sakura Sky.png', 'Rainbow Clouds.png', 'Geo Pop.png', 'Color Rush.png', 'Coral Glow.png', 'Cyber Cyan.png', 'Fresh Green.png', 'Jungle Fever.png', 'Hot Pink.png', 'Baby Blue.png', 'Lilac Haze.png', 'Cyber Lime.png', 'Mountain Air.png', 'Night City.png', 'Midnight Sky.png', 'Flamingo Camo.png', 'Rainy Streets.png', 'Red Confetti.png', 'Robinhood Green.png', 'Beach Day.png', 'Desert Heat.png', 'Skate Park.png', 'Ice Castle.png', 'Outer Space.png', 'Cloudset.png', 'Deep Ocean.png'
      ]
    },
    {
      key: 'Body', label: 'Body', files: [
        'Classic Pink.png', 'Peach.png', 'Lavender.png', 'Cow Print.png', 'Pink Swirls.png', 'Green Freckles.png', 'Yellow Freckles.png', 'White & Pink.png', 'Pink Freckles.png', 'Robot Body.png', 'Rainbow Patchwork.png', 'Mummy Wrap.png', 'Tricolor.png', 'Gray.png', 'Sunset Gradient.png'
      ]
    },
    {
      key: 'clothes', label: 'Clothes', files: [
        'Black Turtleneck.png', 'Black Tuxedo.png', 'Blue Crewneck.png', 'Cyan Hoodie.png', 'Denim Jacket.png', 'Flamingo Floatie.png', 'Green Sweater.png', 'Knight Armor.png', 'none.png', 'Puffer Jacket.png', 'Purple Jersey.png', 'Red Scarf.png', 'Red Varsity Jacket.png', 'Royal Cape.png', 'Track Jacket.png', 'White Fur Coat.png', 'Yellow Suit.png'
      ]
    },
    {
      key: 'Top of head', label: 'Head', files: [
        'Aviator Hat.png', 'Black Side Sweep.png', 'Black Top Hat.png', 'Blonde Side Sweep.png', 'Cowboy Hat.png', 'Devil Horns.png', 'Fried Egg.png', 'Golden Crown.png', 'Golden Halo.png', 'Golden Laurel.png', 'Messy Brown Hair.png', 'Mint Curls.png', 'none.png', 'Pink Afro.png', 'Pink Bow.png', 'Pink Mohawk.png', 'Pink Side Sweep.png', 'Pink Sun Hat.png', 'Pirate Hat.png', 'Police Cap.png', 'Propeller Cap.png', 'Purple Beanie.png', 'Purple Mohawk.png', 'Red Beret.png', 'Sailor Cap.png', 'Sleeping Cap.png', 'Sport Headband.png', 'Straw Boater.png', 'Unicorn Horn.png', 'Wavy Pink Hair.png'
      ]
    },
    {
      key: 'Eyes', label: 'Eyes', files: [
        'Classic Eyes.png', 'Cyan Eyes.png', 'Lightning Eyes.png', 'Sleepy Pink Eyes.png', 'Lux Glasses.png', 'Green Cyber Eyes.png', 'Robot Eyes.png', 'Pink Eyes.png', 'Heterochromia.png', 'Red Laser Eyes.png', 'Side Glance.png', 'Winged Shades.png', '3D Glasses.png', 'Sneaky Eyes.png', 'Black Sunglasses.png'
      ]
    },
    {
      key: 'Mouth', label: 'Mouth', files: [
        'Carrot.png', 'Cigar.png', 'Donut.png', 'Fish.png', 'Grapes.png', 'Lip Piercing.png', 'potatos.png', 'Rainbow Lollipop.png', 'Red Rose.png', 'Shrimp Necklace.png', 'Striped Party Blower.png', 'Tongue Out.png', 'Toothpick.png', 'Worms.png'
      ]
    }
  ];

  const traitNames = {
    Background: [
      'Starry Dream', 'Aqua Flow', 'Neon Arcade', 'Full Court', 'Soft Beige', 'Mono Grid', 'Electric Blue', 'Blue Matrix', 'Twin Towers', 'Lava Cave', 'Sakura Sky', 'Rainbow Clouds', 'Geo Pop', 'Color Rush', 'Coral Glow', 'Cyber Cyan', 'Fresh Green', 'Jungle Fever', 'Hot Pink', 'Baby Blue', 'Lilac Haze', 'Cyber Lime', 'Mountain Air', 'Night City', 'Midnight Sky', 'Flamingo Camo', 'Rainy Streets', 'Red Confetti', 'Robinhood Green', 'Beach Day', 'Desert Heat', 'Skate Park', 'Ice Castle', 'Outer Space', 'Cloudset', 'Deep Ocean'
    ],
    Body: [
      'Classic Pink', 'Peach', 'Lavender', 'Cow Print', 'Pink Swirls', 'Green Freckles', 'Yellow Freckles', 'White & Pink', 'Pink Freckles', 'Robot Body', 'Rainbow Patchwork', 'Mummy Wrap', 'Tricolor', 'Black & White', 'Sunset Gradient'
    ],
    clothes: [
      'White Fur Coat', 'Graphic Hoodie', 'Flamingo Floatie', 'Teal Turtleneck', 'Black Turtleneck', 'Black Tuxedo', 'Red Varsity Jacket', 'Purple Jersey', 'Blue Polo Shirt', 'Green Sweater', 'Yellow Suit', 'Cyan Hoodie', 'Dalmatian Fur Coat', 'Blue Crewneck', 'Purple Tank Top', 'Red Tank Top'
    ],
    'Top of head': [
      'Pirate Hat', 'Straw Boater', 'Pink Sun Hat', 'Pink Mohawk', 'Purple Mohawk', 'Pink Side Sweep', 'Blonde Side Sweep', 'Pink Bow', 'Unicorn Horn', 'Sport Headband', 'Pink Afro', 'Purple Beanie', 'Sleeping Cap', 'Black Side Sweep', 'Devil Horns', 'Wavy Pink Hair', 'Red Beret', 'Sailor Cap', 'Golden Crown', 'Golden Laurel', 'Cowboy Hat', 'Golden Halo', 'Mint Curls', 'Propeller Cap', 'Police Cap', 'Fried Egg', 'Black Top Hat', 'Messy Brown Hair', 'Aviator Hat'
    ],
    Eyes: [
      'Classic Eyes', 'Cyan Eyes', 'Lightning Eyes', 'Sleepy Pink Eyes', 'Wide Eyes', 'Green Cyber Eyes', 'Purple Eyes', 'Pink Eyes', 'Heterochromia', 'Red Laser Eyes', 'Side Glance', 'Winged Shades', '3D Glasses', 'Sneaky Eyes', 'Black Sunglasses'
    ],
    Mouth: [
      'Cigar', 'Rainbow Lollipop', 'Toothpick', 'Carrot', 'Yellow Kazoo', 'Cigarette', 'Red Rose', 'Croissant', 'Blue Fish', 'Dentures', 'Grapes', 'Pink Donut', 'Lip Piercing', 'Tongue Out', 'Striped Party Blower'
    ]
  };

  const canvas = document.getElementById('builder-canvas');
  const ctx = canvas.getContext('2d');
  const tabs = document.getElementById('category-tabs');
  const grid = document.getElementById('trait-grid');
  const loader = document.getElementById('canvas-loader');
  const activeCategory = document.getElementById('active-category');
  const activeTraitName = document.getElementById('active-trait-name');
  const traitCount = document.getElementById('trait-count');
  const shareModal = document.getElementById('share-modal');
  const sharePreviewImage = document.getElementById('share-preview-image');
  const shareImageStatus = document.getElementById('share-image-status');
  const selected = Object.fromEntries(categories.map((category) => [category.key, 0]));
  const imageCache = new Map();
  let currentCategory = categories[0];
  let renderToken = 0;

  function traitUrl(category, file) {
    return `${traitRoot}/${category.key}/${file}`;
  }

  function friendlyName(category, file) {
    return file.replace(/\.(png)$/i, '').replaceAll('_', ' ');
  }

  async function discoverTraitFiles() {
    try {
      const manifestResponse = await fetch('traits-manifest.json', { cache: 'no-store' });
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        categories.forEach((category) => {
          const files = manifest[category.key];
          if (Array.isArray(files) && files.length) category.files = files;
        });
        return;
      }
    } catch (error) {
      console.warn('Trait manifest unavailable; trying directory discovery.', error);
    }

    await Promise.all(categories.map(async (category) => {
      try {
        const response = await fetch(`${traitRoot}/${encodeURIComponent(category.key)}/`, { cache: 'no-store' });
        if (!response.ok) return;
        const html = await response.text();
        const documentListing = new DOMParser().parseFromString(html, 'text/html');
        const discovered = [...documentListing.querySelectorAll('a[href]')]
          .map((link) => {
            const pathname = new URL(link.getAttribute('href'), response.url).pathname;
            return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) || '');
          })
          .filter((name) => /\.png$/i.test(name));

        const uniqueFiles = [...new Set(discovered)].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
        );
        if (uniqueFiles.length) category.files = uniqueFiles;
      } catch (error) {
        console.warn(`Using fallback manifest for ${category.label}`, error);
      }
    }));
  }

  async function initializeBuilder() {
    await discoverTraitFiles();
    traitCount.textContent = `${categories.reduce((sum, category) => sum + category.files.length, 0)} TRAITS`;
    categories.forEach((category) => { selected[category.key] = 0; });
    renderTabs();
    renderTraitGrid();
    renderPreview();
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}`));
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  async function renderPreview() {
    const token = ++renderToken;
    loader.classList.remove('hidden');
    try {
      const layers = await Promise.all(categories.map((category) => {
        const file = category.files[selected[category.key]];
        return loadImage(traitUrl(category, file));
      }));
      if (token !== renderToken) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      layers.forEach((image) => ctx.drawImage(image, 0, 0, canvas.width, canvas.height));
    } catch (error) {
      loader.textContent = 'TRAIT FAILED TO LOAD';
      console.error(error);
      return;
    }
    loader.textContent = 'BUILDING...';
    loader.classList.add('hidden');
  }

  function renderTabs() {
    tabs.replaceChildren(...categories.map((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `category-tab${category === currentCategory ? ' active' : ''}`;
      button.textContent = `${category.label} ${category.files.length}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(category === currentCategory));
      button.addEventListener('click', () => {
        currentCategory = category;
        renderTabs();
        grid.scrollTop = 0;
        renderTraitGrid();
      });
      return button;
    }));
  }

  function renderTraitGrid() {
    const currentIndex = selected[currentCategory.key];
    activeCategory.textContent = currentCategory.label.toUpperCase();
    activeTraitName.textContent = friendlyName(currentCategory, currentCategory.files[currentIndex]);

    grid.replaceChildren(...currentCategory.files.map((file, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `trait-card${index === currentIndex ? ' selected' : ''}`;
      button.title = friendlyName(currentCategory, file);
      button.setAttribute('aria-label', `Select ${friendlyName(currentCategory, file)}`);
      const image = document.createElement('img');
      image.src = traitUrl(currentCategory, file);
      image.alt = '';
      image.loading = 'lazy';
      button.appendChild(image);
      button.addEventListener('click', () => {
        selected[currentCategory.key] = index;
        renderTraitGrid();
        renderPreview();
      });
      return button;
    }));
  }

  document.getElementById('randomize-btn').addEventListener('click', () => {
    categories.forEach((category) => {
      selected[category.key] = Math.floor(Math.random() * category.files.length);
    });
    renderTraitGrid();
    renderPreview();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    categories.forEach((category) => { selected[category.key] = 0; });
    renderTraitGrid();
    renderPreview();
  });

  function downloadCanvas() {
    const link = document.createElement('a');
    link.download = `flamingo-builder-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  document.getElementById('download-builder-btn').addEventListener('click', downloadCanvas);

  function canvasBlob() {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create image')), 'image/png');
    });
  }

  async function prepareShareImage() {
    sharePreviewImage.src = canvas.toDataURL('image/png');
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images unsupported');
      const blob = await canvasBlob();
      await Promise.race([
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard timed out')), 1800))
      ]);
      shareImageStatus.textContent = 'Image copied.';
    } catch (error) {
      console.warn('Image clipboard unavailable:', error);
      downloadCanvas();
      shareImageStatus.textContent = 'Image downloaded.';
    }
  }

  function openShareModal() {
    shareModal.classList.add('open');
    shareModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('share-open');
  }

  function closeShareModal() {
    shareModal.classList.remove('open');
    shareModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('share-open');
  }

  document.getElementById('share-builder-btn').addEventListener('click', async () => {
    openShareModal();
    shareImageStatus.textContent = 'Copying image...';
    await prepareShareImage();
  });

  document.querySelectorAll('[data-close-share]').forEach((element) => element.addEventListener('click', closeShareModal));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeShareModal(); });

  document.getElementById('open-x-btn').addEventListener('click', () => {
    const configuredSite = String(window.WL_CONFIG?.SITE_URL || '').replace(/\/$/, '');
    const builderUrl = configuredSite ? `${configuredSite}/builder.html` : `${window.location.origin}/builder.html`;
    const caption = [
      'Just created my custom @Flamingos_ETH',
      '',
      'Fresh from the Flamingos Builder and ready to join the flock on @RobinhoodApp.',
      '',
      `Build yours: flamingoseth.xyz`,
      '',

    ].join('\n');
    const intent = `https://x.com/intent/post?${new URLSearchParams({ text: caption })}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  });

  initializeBuilder();
})();
