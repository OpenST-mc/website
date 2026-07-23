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
  Object.keys(assets.models).forEach(id => {
    blockModels['minecraft:' + id] = deepslate.BlockModel.fromJson(id, assets.models[id]);
  })
  Object.values(blockModels).forEach(m => m.flatten({ getBlockModel: id => blockModels[id] }));

  const atlasCanvas = document.createElement('canvas');
  const atlasSize = upperPowerOfTwo((textureImage.width >= textureImage.height) ? textureImage.width : textureImage.height);
  atlasCanvas.width = textureImage.width;
  atlasCanvas.height = textureImage.height;

  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.drawImage(textureImage, 0, 0);

  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);

  const idMap = {};

  Object.keys(assets.textures).forEach(id => {
		const [u, v, du, dv] = assets.textures[id]
		const dv2 = (du !== dv && id.startsWith('block/')) ? du : dv
		idMap['minecraft:' + id] = [u / atlasSize, v / atlasSize, (u + du) / atlasSize, (v + dv2) / atlasSize]
	})

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
