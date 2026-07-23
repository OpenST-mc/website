var deepslateResources;

function upperPowerOfTwo(x) {
	x -= 1
	x |= x >> 1
	x |= x >> 2
	x |= x >> 4
	x |= x >> 8
	x |= x >> 18
	x |= x >> 32
	return x + 1
}

// Load Deepslate resources from texture atlas image
// Taken from Deepslate examples
function loadDeepslateResources(textureImage) {
  console.log("loading resources...")
  const blockDefinitions = {};
  Object.keys(assets.blockstates).forEach(id => {
    blockDefinitions['minecraft:' + id] = deepslate.BlockDefinition.fromJson(id, assets.blockstates[id]);
  })

  const blockModels = {};
  var chestModelKeys = ['block/chest', 'block/ender_chest', 'block/trapped_chest'];
  Object.keys(assets.models).forEach(id => {
    if (chestModelKeys.indexOf(id) >= 0) return;
    blockModels['minecraft:' + id] = deepslate.BlockModel.fromJson(id, assets.models[id]);
  })

  // ID map 先构建好
  var atlasSize = upperPowerOfTwo((textureImage.width >= textureImage.height) ? textureImage.width : textureImage.height);

  // 扩展 canvas 以容纳箱子面纹理
  var chestColX = textureImage.width + 4;
  var finalWidth = Math.max(atlasSize, chestColX + 60);
  var finalHeight = Math.max(atlasSize, textureImage.height);
  atlasSize = upperPowerOfTwo(finalWidth > finalHeight ? finalWidth : finalHeight);
  finalWidth = atlasSize;
  finalHeight = atlasSize;

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = finalWidth;
  atlasCanvas.height = finalHeight;
  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.drawImage(textureImage, 0, 0);
  const idMap = {};
  Object.keys(assets.textures).forEach(id => {
    const [u, v, du, dv] = assets.textures[id]
    const dv2 = (du !== dv && id.startsWith('block/')) ? du : dv
    idMap['minecraft:' + id] = [u / atlasSize, v / atlasSize, (u + du) / atlasSize, (v + dv2) / atlasSize]
  })

  // 箱子模型：底座(10px) + 上盖(5px)，内缩 1px，整体 14x14x15
  // 纹理区域与面对应尺寸完全匹配，无需拉伸
  var chestFaceRegions = {
    normal: {
      front_upper: [42, 14, 55, 18],  // 13×4
      front_lower: [42, 33, 55, 42],  // 13×9
      side_upper:  [0,  14, 13, 18],  // 13×4
      side_lower:  [0,  33, 13, 42],  // 13×9
      top:         [28, 0,  41, 13],  // 13×13
      bottom:      [14, 19, 27, 32]   // 13×13
    },
    trapped: {
      front_upper: [42, 14, 55, 18],
      front_lower: [42, 33, 55, 42],
      side_upper:  [0,  14, 13, 18],
      side_lower:  [0,  33, 13, 42],
      top:         [28, 0,  41, 13],
      bottom:      [14, 19, 27, 32]
    },
    ender: {
      front_upper: [0, 0, 64, 64],
      front_lower: [0, 0, 64, 64],
      side_upper:  [0, 0, 64, 64],
      side_lower:  [0, 0, 64, 64],
      top:         [0, 0, 64, 64],
      bottom:      [0, 0, 64, 64]
    }
  };

  function addChestFaceEntry(entityKey, faceKey, region) {
    var tex = assets.textures[entityKey];
    if (!tex) return '';
    var baseU = tex[0], baseV = tex[1];
    var ru = region[0], rv = region[1], rdu = region[2], rdv = region[3];
    var id = 'chest/' + faceKey;
    idMap['minecraft:' + id] = [
      (baseU + ru) / atlasSize,
      (baseV + rv) / atlasSize,
      (baseU + rdu) / atlasSize,
      (baseV + rdv) / atlasSize
    ];
    return id;
  }

  function chestEntityKey(type, face) {
    if (type === 'ender') return 'entity/chest/ender';
    if (face.indexOf('side') === 0) return 'entity/chest/' + type + '_left';
    return 'entity/chest/' + type;
  }

  var chestTextures = {};
  Object.keys(chestFaceRegions).forEach(function(type) {
    chestTextures[type] = {};
    Object.keys(chestFaceRegions[type]).forEach(function(face) {
      chestTextures[type][face] = addChestFaceEntry(
        chestEntityKey(type, face), type + '/' + face, chestFaceRegions[type][face]);
    });
  });

  var chestModels = {};
  Object.keys(chestTextures).forEach(function(type) {
    var t = chestTextures[type];
    var modelKey = 'block/' + (type === 'normal' ? 'chest' : type + '_chest');
    chestModels[modelKey] = {
      elements: [
        {
          from: [1, 0, 1], to: [15, 9, 15],
          faces: {
            down:  { texture: '#bottom', cullface: 'down' },
            north: { texture: '#front_lower' },
            south: { texture: '#front_lower' },
            west:  { texture: '#side_lower' },
            east:  { texture: '#side_lower' }
          }
        },
        {
          from: [1, 9, 1], to: [15, 13, 15],
          faces: {
            up:    { texture: '#top', cullface: 'up' },
            north: { texture: '#front_upper' },
            south: { texture: '#front_upper' },
            west:  { texture: '#side_upper' },
            east:  { texture: '#side_upper' }
          }
        }
      ],
      textures: {
        particle:    'minecraft:chest/' + type + '/front_upper',
        front_upper: 'minecraft:chest/' + type + '/front_upper',
        front_lower: 'minecraft:chest/' + type + '/front_lower',
        side_upper:  'minecraft:chest/' + type + '/side_upper',
        side_lower:  'minecraft:chest/' + type + '/side_lower',
        top:         'minecraft:chest/' + type + '/top',
        bottom:      'minecraft:chest/' + type + '/bottom'
      }
    };
  });
  Object.keys(chestModels).forEach(function(key) {
    blockModels['minecraft:' + key] = deepslate.BlockModel.fromJson(key, chestModels[key]);
  })
  Object.values(blockModels).forEach(m => m.flatten({ getBlockModel: id => blockModels[id] }));

  // 从 entity PNG 中裁切各面子区域，画到 atlas 右侧独立位置
  function addChestFaceImg(imgId, sx, sy, sw, sh, dstX, dstY, mapKey) {
    var img = document.getElementById(imgId);
    if (!img || !img.complete || img.naturalWidth <= 0) return;
    atlasCtx.drawImage(img, sx, sy, sw, sh, dstX, dstY, sw, sh);
    idMap['minecraft:' + mapKey] = [
      dstX / atlasSize,
      dstY / atlasSize,
      (dstX + sw) / atlasSize,
      (dstY + sh) / atlasSize
    ];
  }

  // 扩展 canvas 宽度以容纳箱子面纹理
  var chestColX = textureImage.width + 4;

  // 坐标映射: [sx,sy,sw,sh] 从 entity PNG 中裁切，[dstX,dstY] 是 atlas 目标位置
  var chestFaces = {
    normal: {
      front_upper: { img: 'chest-normal',          s: [42,14,13,4] },
      front_lower: { img: 'chest-normal',          s: [42,33,13,9] },
      side_upper:  { img: 'chest-normal-left',     s: [0, 14,13,4] },
      side_lower:  { img: 'chest-normal-left',     s: [0, 33,13,9] },
      top:         { img: 'chest-normal',          s: [28,0, 13,13] },
      bottom:      { img: 'chest-normal',          s: [14,19,13,13] }
    },
    trapped: {
      front_upper: { img: 'chest-trapped',         s: [42,14,13,4] },
      front_lower: { img: 'chest-trapped',         s: [42,33,13,9] },
      side_upper:  { img: 'chest-trapped-left',    s: [0, 14,13,4] },
      side_lower:  { img: 'chest-trapped-left',    s: [0, 33,13,9] },
      top:         { img: 'chest-trapped',         s: [28,0, 13,13] },
      bottom:      { img: 'chest-trapped',         s: [14,19,13,13] }
    },
    ender: {
      front_upper: { img: 'chest-ender',           s: [0,0,64,64] },
      front_lower: { img: 'chest-ender',           s: [0,0,64,64] },
      side_upper:  { img: 'chest-ender',           s: [0,0,64,64] },
      side_lower:  { img: 'chest-ender',           s: [0,0,64,64] },
      top:         { img: 'chest-ender',           s: [0,0,64,64] },
      bottom:      { img: 'chest-ender',           s: [0,0,64,64] }
    }
  };

  var cy = 0;
  Object.keys(chestFaces).forEach(function(type) {
    cy = 0;
    Object.keys(chestFaces[type]).forEach(function(face) {
      var f = chestFaces[type][face];
      var ss = f.s;
      addChestFaceImg(f.img, ss[0], ss[1], ss[2], ss[3],
        chestColX, cy, 'chest/' + type + '/' + face);
      cy += ss[3] + 1;
    });
  });

  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);
  const textureAtlas = new deepslate.TextureAtlas(atlasData, idMap);

  deepslateResources = {
    getBlockDefinition(id) { return blockDefinitions[id] },
    getBlockModel(id) { return blockModels[id] },
    getTextureUV(id) { return textureAtlas.getTextureUV(id) },
    getTextureAtlas() { return textureAtlas.getTextureAtlas() },
    getBlockFlags(id) {
      return {
        opaque: OPAQUE_BLOCKS.has(id.toString()),
        self_culling: !NON_SELF_CULLING.has(id.toString()),
        semi_transparent: TRANSPARENT_BLOCKS.has(id.toString()),
      };
    },
    getBlockProperties(id) { return null },
    getDefaultBlockProperties(id) { return null },
  }

  return deepslateResources;
}

function structuresFromLitematic(litematic, y_min, y_max) {
  if (typeof y_min === 'undefined') y_min = 0;
  if (typeof y_max === 'undefined') y_max = -1;

  var regions = litematic.regions;
  var result = [];
  var totalBlocks = 0;

  console.log("Building blocks from", regions.length, "regions...");

  for (var ri = 0; ri < regions.length; ri++) {
    var r = regions[ri];
    var blocks = r.blocks;
    var blockPalette = r.blockPalette;
    var pos = r.position || [0, 0, 0];

    var w = r.width;
    var h = r.height;
    var d = r.depth;
    var wd = w * d;

    var effYMax = (y_max == -1) ? h : Math.min(y_max, h);
    var regBlockCount = 0;

    var structure = new deepslate.Structure([w, h, d]);

    for (var x = 0; x < w; x++) {
      for (var y = y_min; y < effYMax; y++) {
        var idx = y * wd + x;
        for (var z = 0; z < d; z++, idx += w) {
          var blockID = blocks[idx];

          if (blockID <= 0) continue;
          if (blockID >= blockPalette.length) {
            structure.addBlock([x, y, z], "minecraft:cake");
            continue;
          }

          var blockInfo = blockPalette[blockID];
          regBlockCount++;
          var props = blockInfo.Properties;

          if (props) {
            structure.addBlock([x, y, z], blockInfo.Name, props);
          } else {
            structure.addBlock([x, y, z], blockInfo.Name);
          }
        }
      }
    }

    result.push({ structure: structure, position: pos });
    totalBlocks += regBlockCount;
  }

  console.log("Done!", totalBlocks, " blocks created across", regions.length, "regions");
  return result;
}
