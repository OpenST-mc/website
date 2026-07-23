class Litematic { }

class LitematicRegion {
  constructor(width, height, depth) {
    this.width = width;
    this.height = height;
    this.depth = depth;
  }
}

function readLitematicFromNBTData(nbtdata) {
  // Get rid of all the annoying stuff basically

  var litematic = new Litematic();
  litematic.regions = new Array();

  var regions = nbtdata.value.Regions.value;
  for (let regionName in regions) {
    
    var region = regions[regionName].value;
    
    var blockPalette = __stripNBTTyping(region.BlockStatePalette);
    
    // Find the minimum number of bits needed to express all blocks
    nbits = Math.ceil(Math.log2(blockPalette.length));

    width = region.Size.value.x.value; 
    height = region.Size.value.y.value;
    depth = region.Size.value.z.value; 

    var blockData = region.BlockStates.value;

    var blocks = processNBTRegionData(blockData, nbits, width, height, depth);

    var litematicRegion = new LitematicRegion(width, height, depth);
    litematicRegion.name = regionName;
    litematicRegion.size = [width, height, depth];
    litematicRegion.blocks = blocks;
    litematicRegion.blockPalette = blockPalette;

    // 解析子投影的世界坐标偏移量
    if (region.Position) {
      var posX = region.Position.value.x.value;
      var posY = region.Position.value.y.value;
      var posZ = region.Position.value.z.value;
      litematicRegion.position = [posX, posY, posZ];
    } else {
      litematicRegion.position = [0, 0, 0];
    }

    litematic.regions.push(litematicRegion);
  }

  return litematic;
}

function processNBTRegionData(regionData, nbits, width, height, depth) {
  // 使用 Y-major 平坦 TypedArray 替代 3D JS 数组，大幅降低内存占用
  // 索引公式: index = y * width * depth + z * width + x

  var w = Math.abs(width);
  var h = Math.abs(height);
  var d = Math.abs(depth);
  var total = w * h * d;
  var mask = (1 << nbits) - 1;
  var y_shift = w * d;
  var z_shift = w;

  var blocks = new Uint16Array(total);

  for (var x = 0; x < w; x++) {
    for (var y = 0; y < h; y++) {
      var baseIdx = y * y_shift + x;
      for (var z = 0; z < d; z++) {
        var linearIdx = y * y_shift + z * z_shift + x;

        var start_offset = linearIdx * nbits;
        var start_arr_index = start_offset >>> 5;
        var end_arr_index = ((linearIdx + 1) * nbits - 1) >>> 5;
        var start_bit_offset = start_offset & 0x1F;

        var half_ind = start_arr_index >>> 1;
        var blockStart, blockEnd;
        if ((start_arr_index & 0x1) == 0) {
          blockStart = regionData[half_ind][1];
          blockEnd = regionData[half_ind][0];
        } else {
          blockStart = regionData[half_ind][0];
          if (half_ind + 1 < regionData.length) {
            blockEnd = regionData[half_ind + 1][1];
          } else {
            blockEnd = 0x0;
          }
        }

        if (start_arr_index == end_arr_index) {
          blocks[baseIdx + z * z_shift] = (blockStart >>> start_bit_offset) & mask;
        } else {
          var end_offset = 32 - start_bit_offset;
          var val = ((blockStart >>> start_bit_offset) & mask) | ((blockEnd << end_offset) & mask);
          blocks[baseIdx + z * z_shift] = val;
        }
      }
    }
  }
  return blocks;
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
    var blocks = region.blocks;
    var blockPalette = region.blockPalette;
    var w = region.width;
    var h = region.height;
    var d = region.depth;
    var wd = w * d;

    for (var x = 0; x < w; x++) {
      for (var y = 0; y < h; y++) {
        var idx = y * wd + x;
        for (var z = 0; z < d; z++, idx += w) {
          var blockID = blocks[idx];
          if (blockID > 0) {
            if (blockID < blockPalette.length) {
              var blockName = blockPalette[blockID].Name;
              blockCounts[blockName] = (blockCounts[blockName] || 0) + 1;
            } else {
              blockCounts["unknown"] = (blockCounts["unknown"] || 0) + 1;
            }
          }
        }
      }
    }
  }

  return blockCounts;
}