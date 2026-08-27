class Litematic { }

class LitematicRegion {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }
}

function readLitematicFromNBTData(nbtdata) {

  var litematic = new Litematic();
  litematic.regions = [];

  var regions = nbtdata.value.Regions.value;
  for (var regionName in regions) {

    var region = regions[regionName].value;

    var blockPalette = __stripNBTTyping(region.BlockStatePalette);

    var nbits = Math.ceil(Math.log2(blockPalette.length));

    var w = Math.abs(region.Size.value.x.value);
    var h = Math.abs(region.Size.value.y.value);
    var d = Math.abs(region.Size.value.z.value);

    var packedData = region.BlockStates.value;

    var litematicRegion = new LitematicRegion(w, h, d);
    litematicRegion.name = regionName;
    litematicRegion.size = [w, h, d];
    litematicRegion.packedData = packedData;
    litematicRegion.nbits = nbits;
    litematicRegion.blockPalette = blockPalette;

    // 解析子投影的世界坐标偏移量
    if (region.Position) {
      litematicRegion.position = [
        region.Position.value.x.value,
        region.Position.value.y.value,
        region.Position.value.z.value
      ];
    } else {
      litematicRegion.position = [0, 0, 0];
    }

    litematic.regions.push(litematicRegion);
  }

  return litematic;
}

// 按需解码：从 packed bit 数据中解码指定 Y 范围，回调仅对非空气方块触发
function iterateRegionBlocks(region, y_min, y_max, callback) {
  var packedData = region.packedData;
  var nbits = region.nbits;
  var w = region.width;
  var h = region.height;
  var d = region.depth;

  var effectiveMax = (y_max === -1 || typeof y_max === 'undefined') ? h : Math.min(y_max, h);
  if (y_min >= h) return;

  var mask = (1 << nbits) - 1;
  var wd = w * d;
  var packedLen = packedData.length;

  for (var x = 0; x < w; x++) {
    for (var y = y_min; y < effectiveMax; y++) {
      var baseIdx = y * wd + x;
      for (var z = 0; z < d; z++) {
        var linearIdx = baseIdx + z * w;

        var start_offset = linearIdx * nbits;
        var start_arr_index = start_offset >>> 5;
        var end_arr_index = ((linearIdx + 1) * nbits - 1) >>> 5;
        var start_bit_offset = start_offset & 0x1F;

        var half_ind = start_arr_index >>> 1;
        var blockStart, blockEnd;
        if ((start_arr_index & 0x1) === 0) {
          blockStart = packedData[half_ind][1];
          blockEnd = packedData[half_ind][0];
        } else {
          blockStart = packedData[half_ind][0];
          if (half_ind + 1 < packedLen) {
            blockEnd = packedData[half_ind + 1][1];
          } else {
            blockEnd = 0;
          }
        }

        var blockID;
        if (start_arr_index === end_arr_index) {
          blockID = (blockStart >>> start_bit_offset) & mask;
        } else {
          var end_offset = 32 - start_bit_offset;
          blockID = ((blockStart >>> start_bit_offset) & mask) | ((blockEnd << end_offset) & mask);
        }

        if (blockID > 0) {
          callback(x, y, z, blockID);
        }
      }
    }
  }
}

// Hacky function needed to convert NBT to pure JSON
// use at your own risk
function __stripNBTTyping(nbtData) {
  if (nbtData.hasOwnProperty("type")) {
    switch(nbtData.type) {
      case "compound":
        var newDict = {}
        for (const [k, v] of Object.entries(nbtData.value)) {
          newDict[k] = __stripNBTTyping(v);
        }
        return newDict;
        break;
      case "list":
        var newList = [];
        for (const [k, v] of Object.entries(nbtData.value.value)) {
          newList[k] = __stripNBTTyping(v);
        }
        return newList;
        break;
      default:
        return nbtData.value;
    } 
  } else {
    switch(nbtData.constructor) {
      case Object:
        var newDict = {}
        for (const [k, v] of Object.entries(nbtData)) {
          newDict[k] = __stripNBTTyping(v);
        }
        return newDict;
        break;
      default:
        return nbtData;
    }
  }
}


function getMaterialList(litematic) {
  var blockCounts = {};

  for (var ri = 0; ri < litematic.regions.length; ri++) {
    var region = litematic.regions[ri];
    var blockPalette = region.blockPalette;

    iterateRegionBlocks(region, 0, -1, function(x, y, z, blockID) {
      if (blockID < blockPalette.length) {
        var blockName = blockPalette[blockID].Name;
        blockCounts[blockName] = (blockCounts[blockName] || 0) + 1;
      } else {
        blockCounts["unknown"] = (blockCounts["unknown"] || 0) + 1;
      }
    });
  }

  return blockCounts;
}