//Reference: Slippy map tilenames
//https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
const lon2tile = (lon,zoom) => { return (Math.floor((lon+180)/360*Math.pow(2,zoom))); }

const lat2tile = (lat,zoom) => { return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); }

const lon2tiled = (lon,zoom) => { return ((lon+180)/360*Math.pow(2,zoom)); }

const lat2tiled = (lat,zoom) => { return ((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)); }

const tile2long = (x,z) => { return (x/Math.pow(2,z)*360-180); }

const tile2lat  = (y,z) => {
  const n=Math.PI-2*Math.PI*y/Math.pow(2,z);
  return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
}

const global = {
  btile: [14, 14623, 6017],
  zl: 10,
  // nwOriginText: "0,0"
}

const cvPt = ( xy, info = {} ) => {
  /* convert Point
   * 地理座標等をスライド内座標へ
   * タイル枚数として、2×3くらいを想定（オフセットの影響が大きい）
   * とりあえず、今は仮置き
   */
  
  // スライド原点用の計算（単位はタイル座標）
  // タイル座標は必ずしも整数ではない
  // const ex = 6400800; // 仮置き
  const ext = 12;
  const b = global.btile || [2, 3, 1]; //左上
  const bx = b[1] * Math.pow(2, ext);
  const by = b[2] * Math.pow(2, ext);
  
  // offset はスライド内座標（EMU）で与えられることを想定
  const ox = info.offsetX || 0;
  const oy = info.offsetY || 0;
  
  // タイル座標へ変換 (ZL15基準の座標で)
  const cx = lon2tiled(xy[0], b[0] + ext);
  const cy = lat2tiled(xy[1], b[0] + ext);
  
  // スライド原点からのオフセットを算出
  // この時点では、まだ単位はタイル座標。
  const dx = Math.abs( cx - bx ); // 大体ZL15で3桁くらい
  const dy = Math.abs( cy - by );
  
  // オブジェクト内原点からのオフセットを算出
  // スライド内で適当な大きさで表示されるように 1024 をかけて EMU として適当な値にする。
  const X = Math.floor( dx * 1024 - ox );
  const Y = Math.floor( dy * 1024 - oy );
  
  return {
    "_": `<a:pt x="${X}" y="${Y}"/>`,
    "x": X, 
    "y": Y
  };
  
};

const mkLineGeom = (array, info = {} ) => {
  /* make Line Geometry
   * [x, y] の配列を受け取り、ライン形式のジオメトリを作成する。
   */
  
  let xs = "";
  let cxn = "";
  
  const n = array.length;
  
  // ここで経緯度→タイル→スライド座標
  const startPos = cvPt([ array[0][0],array[0][1] ], info);
  xs += `<a:moveTo>${startPos._}</a:moveTo>`;
  cxn += `<a:cxn ang="0"><a:pos x="${startPos.x}" y="${startPos.y}"/></a:cxn>`;
  
  let minX = startPos.x;
  let minY = startPos.y;
  let maxX = startPos.x;
  let maxY = startPos.y;
  
  for(let i = 1; i < n; i++){
    // ここで経緯度→タイル→スライド座標
    const pos = cvPt([ array[i][0],array[i][1] ], info);
    
    xs += `<a:lnTo>${pos._}</a:lnTo>`;
    //xs += `<a:cubicBezTo>${pos._}${pos._}${pos._}</a:cubicBezTo>`;
    cxn += `<a:cxn ang="0"><a:pos x="${pos.x}" y="${pos.y}"/></a:cxn>`;
    
    minX = (minX > pos.x) ? pos.x : minX;
    minY = (minY > pos.y) ? pos.y : minY;
    maxX = (maxX < pos.x) ? pos.x : maxX;
    maxY = (maxY < pos.y) ? pos.y : maxY;
  }
  
  const extX = info.extX || maxX;
  const extY = info.extY || maxY;
  
  xs = `<a:custGeom>
        <a:avLst/>
        <a:gdLst/>
        <a:ahLst/>
        <a:cxnLst/>
        <a:rect l="l" t="t" r="r" b="b"/>
        <a:pathLst><a:path w="${extX}" h="${extY}">${xs}</a:path></a:pathLst>
        </a:custGeom>`;
  
  return {
    "xml": xs,
    "info": {
      "minX": minX,
      "minY": minY,
      "maxX": maxX,
      "maxY": maxY
    }
  };
  
}



const mkLine = (array, style = {}, info = {}) => {
  /* make Line object
   * [x, y] の配列(array)とスタイルのオブジェクト(style)とその他の情報オブジェクト(info)を受け取り、ラインのスライド内オブジェクトを作成する。
   */
  
  // ここで経緯度→タイル→スライド座標
  const geomInfo = mkLineGeom(array, info);
  const geom = geomInfo.xml;
  const gi = geomInfo.info;
  
  if(!style) style = {};
  
  const color = style.color || "FFAAAA";
  const width = style.width || "8000"; // 5桁前後（3pxで38100）
  
  if(!info) info = {};
  
  const title = info.title || "自作ラインオブジェクト";
  const id = info.id || Math.floor(Math.random() * 100000) + 1;
  const offsetX = info.offsetX || 0;
  const offsetY = info.offsetY || 0;
  
  const extX = info.extX || 6400800; //仮置き
  const extY = info.extY || Math.floor(6400800 * (gi.maxY/gi.maxY)); // A3だと12801600
  
  const line = `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${title}">
        <a:extLst><a:ext uri="${id}">
        <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="${id}"/>
        </a:ext></a:extLst>
      </p:cNvPr>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    
    <p:spPr>
    <a:xfrm>
      <a:off x="${offsetX}" y="${offsetY}"/>
      <a:ext cx="${extX}" cy="${extY}"/>
    </a:xfrm>

    ${geom}
    
    <a:noFill/>
    <a:ln w="${width}">
      <a:solidFill>
      <a:srgbClr val="${color}"/>
      </a:solidFill>
    </a:ln>
    </p:spPr>
    
    <p:style>
      <a:lnRef idx="2">
      <a:schemeClr val="accent1">
      <a:shade val="50000"/>
      </a:schemeClr>
      </a:lnRef>
      <a:fillRef idx="1">
      <a:schemeClr val="accent1"/>
      </a:fillRef>
      <a:effectRef idx="0">
      <a:schemeClr val="accent1"/>
      </a:effectRef>
      <a:fontRef idx="minor">
      <a:schemeClr val="lt1"/>
      </a:fontRef>
    </p:style>
    
    <p:txBody>
      <a:bodyPr rtlCol="0" anchor="ctr"/>
      <a:lstStyle/>
      <a:p>
      <a:pPr algn="ctr"/>
      <a:endParaRPr kumimoji="1" lang="ja-JP" altLang="en-US" dirty="0"/>
      </a:p>
    </p:txBody>
  </p:sp>`;
  
  return line.replace("\r", "").replace("\n", "").replace(/>\s+</g, "><");
  
}


const mkPrstGeom = (point, style = {}, info = {}) => {
  /* make Line object
   * [x, y] (point)とスタイルのオブジェクト(style)とその他の情報オブジェクト(info)を受け取り、prstGeom のスライド内オブジェクトを作成する。
   */
  
  // ここで経緯度→タイル→スライド座標
  const XY = cvPt(point, info);
  
  if(!style) style = {};
  
  const color = style.color || "FFAAAA";
  const width = style.width || "8000"; // 5桁前後（3pxで38100）
  
  if(!info) info = {};
  
  const title = info.title || "自作ラインオブジェクト";
  const id = info.id || Math.floor(Math.random() * 100000) + 1;
  
  const size = info.size || 100000; 
  const prst = info.prst || "ellipse";
  // 例： ▲ "triangle", ＋ "mathPlus", × "mathMultiply", ● "ellipse"
  
  const offsetX = XY.x - size/2 || 0;
  const offsetY = XY.y - size/2 || 0;
  
  const extX = size;
  const extY = size;
  
  const line = `<p:sp>
    <p:nvSpPr>
    <p:cNvPr id="${id}" name="${title}">
    <a:extLst>
    <a:ext uri="${id}">
    <a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" id="${id}"/>
    </a:ext>
    </a:extLst>
    </p:cNvPr>
    <p:cNvSpPr/>
    <p:nvPr/>
    </p:nvSpPr>
    
    <p:spPr>
      <a:xfrm>
      <a:off x="${offsetX}" y="${offsetY}"/>
      <a:ext cx="${extX}" cy="${extY}"/>
      </a:xfrm>
      
      <a:prstGeom prst="${prst}">
        <a:avLst />
      </a:prstGeom>
      
      <a:solidFill>
        <a:srgbClr val="${color}"/>
      </a:solidFill>
    </p:spPr>
    
    <p:style>
    <a:lnRef idx="2">
    <a:schemeClr val="accent1">
    <a:shade val="15000"/>
    </a:schemeClr>
    </a:lnRef>
    <a:fillRef idx="1">
    <a:schemeClr val="accent1"/>
    </a:fillRef>
    <a:effectRef idx="0">
    <a:schemeClr val="accent1"/>
    </a:effectRef>
    <a:fontRef idx="minor">
    <a:schemeClr val="lt1"/>
    </a:fontRef>
    </p:style>
    <p:txBody>
    <a:bodyPr rtlCol="0" anchor="ctr"/>
    <a:lstStyle/>
    <a:p>
    <a:pPr algn="ctr"/>
    <a:endParaRPr kumimoji="1" lang="ja-JP" altLang="en-US"/>
    </a:p>
</p:txBody>
</p:sp>`;
  
  return line.replace("\r", "").replace("\n", "").replace(/>\s+</g, "><");
  
}



const mkSlide = (paths) => {
  
  const lines = [];
  const points = [];
  let lngMin;
  let lngMax;
  let latMin;
  let latMax;
  
  
  paths.forEach( path => {
    const geojson = require(path);
    const fs = geojson.features;
    fs.forEach( f => {
      if(f.geometry.type == "LineString"){
        lines.push({"geom": f.geometry.coordinates, "prop": f.properties});
      }else if(f.geometry.type == "MultiLineString"){
        f.geometry.coordinates.forEach( lineCoords => {
          lines.push({"geom": lineCoords, "prop": f.properties});
        });
      }else if(f.geometry.type == "Polygon"){
        f.geometry.coordinates.forEach( lineCoords => {
          lines.push({"geom": lineCoords, "prop": {...f.properties, "isPoly": true } });
        });
      }else if(f.geometry.type == "MultiPolygon"){
        f.geometry.coordinates.forEach( poly => {
          poly.forEach( lineCoords => {
            lines.push({"geom": lineCoords, "prop": {...f.properties, "isPoly": true } });
          });
        });
      }else if(f.geometry.type == "MultiPoint"){
        f.geometry.coordinates.forEach( point => {
          points.push({"geom": point, "prop": {...f.properties } });
        });
      }else if(f.geometry.type == "Point"){
        points.push({"geom": f.geometry.coordinates, "prop": {...f.properties } });
      }
    });
    
  });
  
  let xs = "";
  
  // 全座標を取得
  lines.forEach( lineInfo => {
    
    const line = lineInfo.geom;
    
    line.forEach( p => {
      if(p && typeof(p[0]) == "number" && typeof(p[1]) == "number"){
        
        if(lngMin){
          lngMin = Math.min(p[0], lngMin);
        }else{
          lngMin = p[0];
        }
        
        if(lngMax){
          lngMax = Math.max(p[0], lngMax);
        }else{
          lngMax = p[0];
        }
        
        if(latMin){
          latMin = Math.min(p[1], latMin);
        }else{
          latMin = p[1];
        }
        
        if(latMax){
          latMax = Math.max(p[1], latMax);
        }else{
          latMax = p[1];
        }
      }
    });
    
  });

  points.forEach( pointInfo => {
    
    const p = pointInfo.geom;
    
    if(p && typeof(p[0]) == "number" && typeof(p[1]) == "number"){
      
      if(lngMin){
        lngMin = Math.min(p[0], lngMin);
      }else{
        lngMin = p[0];
      }
      
      if(lngMax){
        lngMax = Math.max(p[0], lngMax);
      }else{
        lngMax = p[0];
      }
      
      if(latMin){
        latMin = Math.min(p[1], latMin);
      }else{
        latMin = p[1];
      }
      
      if(latMax){
        latMax = Math.max(p[1], latMax);
      }else{
        latMax = p[1];
      }
    }
    
  });
  // console.log(xlist);
  // console.log(ylist);
  
  
  // 元データの地理的領域はここで検証可能
  // ZLが与えられれば、北西のコーナーの座標がわかる。
  const zl = global.zl;
  
  const nwOriginText = global.nwOriginText;
  const nwOrigin = nwOriginText && nwOriginText.match(/^\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*$/) ? 
                   nwOriginText.split(",").map( x => +x ) : null;
  
  const nw = nwOrigin ? [lon2tiled(nwOrigin[0], zl), lat2tiled(nwOrigin[1], zl)]
                      : [lon2tiled(lngMin, zl), lat2tiled(latMax, zl)]; 
  
  global.btile = [zl, nw[0], nw[1]]; // タイル番号は整数にしなくても大丈夫
  
  // 地理座標系とタイル・スライド座標系のY軸は逆
  // ここの全座標の min, max は使わなくてもよいかも。
  const min = cvPt([ lngMin, latMax ]);
  const max = cvPt([ lngMax, latMin ]);
  
  let minX = min.x;
  let minY = min.y; 
  let maxX = max.x;
  let maxY = max.y; 
  
  lines.forEach( lineInfo => {
    
    const line = lineInfo.geom;
    const prop = lineInfo.prop;
    
    let iLngMin;
    let iLngMax;
    let iLatMin;
    let iLatMax;
    
    line.forEach( p => {
      if(p && typeof(p[0]) == "number" && typeof(p[1]) == "number"){
        if(iLngMin){
          iLngMin = Math.min(p[0], iLngMin);
        }else{
          iLngMin = p[0];
        }
        
        if(iLngMax){
          iLngMax = Math.max(p[0], iLngMax);
        }else{
          iLngMax = p[0];
        }
        
        if(iLatMin){
          iLatMin = Math.min(p[1], iLatMin);
        }else{
          iLatMin = p[1];
        }
        
        if(iLatMax){
          iLatMax = Math.max(p[1], iLatMax);
        }else{
          iLatMax = p[1];
        }
      }
    });
    
    // 地理座標系とタイル・スライド座標系のY軸は逆
    const iMin = cvPt([ iLngMin, iLatMax ]);
    const iMax = cvPt([ iLngMax, iLatMin ]);
  
    let iMinX = iMin.x;
    let iMinY = iMin.y;
    let iMaxX = iMax.x;
    let iMaxY = iMax.y;
    
    const iExtX = Math.floor( iMaxX - iMinX );
    const iExtY = Math.floor( iMaxY - iMinY );
    
    /*
    console.log(
      lngMin, lngMax, latMin, latMax,
      iLngMin, iLngMax, iLatMin, iLatMax,
      maxX, iMaxX, maxY, iMaxY, iExtX, iExtY
    );
    */
    
    // スタイル設定
    let color = "888888";
    let width = 8000;
    let title = "その他";
    if(prop){
      //従来版ベクトルタイル用
      if( prop.ftCode >= 3000 && prop.ftCode < 3999 ){
        color = "99AACC"; width = 4000;
      }else if( prop.ftCode >= 2700 && prop.ftCode < 2799 ){
        color = "666666";
        let rnkWidth = prop.rnkWidth || 1;
        width = 4000 + 6000 * rnkWidth;
      }else if( prop.ftCode == 8201 ){
        color = (prop.staCode && prop.staCode != "0") ? "FF0000" : "FF8888";
        width = (prop.staCode && prop.staCode != "0") ? 40000 : 
                (prop.snglDbl && prop.snglDbl == 2) ? 12000 : width;
      }else if( prop.ftCode >= 1200 && prop.ftCode < 1299 ){
        color = "8866BB";
      }else if( prop.ftCode >= 5000 && prop.ftCode < 5999 ){
        color = "0000FF"; width = 12000;
      }else if( prop.ftCode >= 7000 && prop.ftCode < 7999 ){
        color = "559900";
      }
      
      //最適化ベクトルタイル用
      if( prop.vt_code >= 3000 && prop.vt_code < 3999 ){
        // 建物
        title = "建物";
        color = "99AACC"; width = 4000;
      }else if( prop.vt_code >= 2700 && prop.vt_code < 2799 ){
        // 道路
        title = "道路";
        const rdctgSet = {
          "高速自動車国道等": "339933",
          "国道": "FF8888",
          "都道府県道": "EECC11"
        }
        
        if(prop.vt_motorway == 1){
          color = rdctgSet["高速自動車国道等"];
          title += "-" + "高速自動車国道等";
        }else{
          color = rdctgSet[prop.vt_rdctg] || "666666";
          title += "-" + prop.vt_rdctg;
        }
        
        const rnkWidthSet = {
          "3m未満": 1,
          "3m以上5.5m未満": 2,
          "5.5m以上13m未満": 3,
          "13m以上19.5m未満": 4,
          "19.5m以上": 5,
          "その他": 1,
          "不明": 1,
          "3m-5.5m未満": 2,
          "5.5m-13m未満": 3,
          "13m-19.5m未満": 4,
        };
        
        let rnkWidth = rnkWidthSet[prop.vt_rnkwidth] || 1;
        width = 4000 + 6000 * rnkWidth;
        title += "-" + prop.vt_rnkwidth;
      }else if( prop.vt_code == 8201 || (prop.vt_code >= 2800 && prop.vt_code < 2899) ){
        // 鉄道
        title = "鉄道";
        color = (prop.vt_sngldbl && prop.vt_sngldbl != "駅部分")  ? "FF0000" : "FF8888";
        width = (prop.vt_sngldbl && prop.vt_sngldbl == "駅部分")  ? 40000 : 
                (prop.vt_sngldbl && prop.vt_sngldbl == "複線以上") ? 12000 : width;
      }else if( prop.vt_code >= 1200 && prop.vt_code < 1299 ){
        // 境界
        title = "境界";
        color = "8866BB";
      }else if( prop.vt_code >= 5000 && prop.vt_code < 5999 ){
        // 水域関係
        title = "水域";
        color = "0000FF"; width = 12000;
      }else if( prop.vt_code >= 7000 && prop.vt_code < 7999 ){
        // 等高線・地形関係
        title = "地形";
        color = "559900"; width = 4000;
      }
      
    }
    
    // ここで経緯度→タイル→スライド座標
    const ch = mkLine(line, {
        "color": color,
        "width": width
      },
      {
        "title": title,
        "extX": iExtX, 
        "extY": iExtY,
        "offsetX": iMinX,
        "offsetY": iMinY
    });
      
    if(ch.match("NaN")){
      return; // 応急処置
    }
    xs += ch;
  });
  

  points.forEach( pointInfo => {
    
    const point = pointInfo.geom;
    const prop = pointInfo.prop;
    
    // スタイル設定
    let color = "FF0000";
    let width = 8000;
    let title = "POI";
    
    const size = 200000;
    const prst = "mathMultiply";
    // 例： ▲ "triangle", ＋ "mathPlus", × "mathMultiply", ● "ellipse"
    
    // ここで経緯度→タイル→スライド座標
    const ch = mkPrstGeom(point, {
        "color": color,
        "width": width
      },
      {
        "title": title,
        "size": size,
        "prst": prst
    });
      
    if(ch.match("NaN")){
      return; // 応急処置
    }
    xs += ch;
  });
  
  
  const id = Math.floor(Math.random() * 100000) + 1;
  
  const res = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

    <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
    <p:cSld>
    <p:spTree>
    
    <p:nvGrpSpPr>
      <p:cNvPr id="1" name=""/>
      <p:cNvGrpSpPr/>
      <p:nvPr/>
    </p:nvGrpSpPr>
    <p:grpSpPr>
    <a:xfrm>
      <a:off x="0" y="0"/>
      <a:ext cx="0" cy="0"/>
      <a:chOff x="0" y="0"/>
      <a:chExt cx="0" cy="0"/>
    </a:xfrm>
    </p:grpSpPr>

      ${xs}

    </p:spTree>
    <p:extLst>
      <p:ext uri="{${id}}">
      <p14:creationId xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="${id}"/>
      </p:ext>
    </p:extLst>
    </p:cSld>
    
    <p:clrMapOvr>
      <a:masterClrMapping/>
    </p:clrMapOvr>
    </p:sld>`;
  
  
  return res;
  
}



//入力： array of paths to GeoJSON files (拡張子は.json)
global.zl = 13;
const slide = mkSlide(["./data.json"]);
console.log(slide);


