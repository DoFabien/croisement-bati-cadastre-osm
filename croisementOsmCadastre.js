const Flatbush = require('flatbush');
const turf = require('@turf/turf');
const martinez = require('martinez-polygon-clipping');

// Change les properties à partir du bati du cadastre en OSM compatible
const toOsmAttributs = function (_geojsonCadastre) {
    let geojsonCadastre = JSON.parse(JSON.stringify(_geojsonCadastre))
    let featureCadastre = geojsonCadastre.features;
    for (let i = 0; i < featureCadastre.length; i++) {
        let properties = {};
        properties['building'] = 'yes';
        properties['source'] = 'cadastre-dgi-fr source : Direction Générale des Impôts - Cadastre. Mise à jour : 2018'
        if (featureCadastre[i]['properties']['dur'] == '02') {
            properties['wall'] = 'no';
        }
        featureCadastre[i]['properties'] = properties;
    }
    return geojsonCadastre;
}




const truncateOptions = { precision: 6, coordinates: 2 };


/*
 Retourne les features :
    - Dans le cadastre mais pas du tout dans OSM
    - Dans le cadastre et dans OSM mais avec un tx de recouvrement < 80%
    - Dans le cadastre et dans OSM  avec un tx de recouvrement > 80%
*/
const getNewBuildings = function (geojsonCadastre, geojsonOSM) {
    const osmFeatures = geojsonOSM.features;
    const index = new Flatbush(osmFeatures.length);
    let newBatiFeatures = []; // bati sans aucune interscection
    let conflictBati = []; // avec un tx de recouvrement < 80%
    let stableBati = []; // bati stable, présent dans le cadastre et dans osm

    for (let i = 0; i < osmFeatures.length; i++) {
        let bboxOsmFeature = turf.bbox(osmFeatures[i]);
        // console.log(bboxOsmFeature);
        index.add(bboxOsmFeature[0], bboxOsmFeature[1], bboxOsmFeature[2], bboxOsmFeature[3]);
    }
    index.finish();

    const cadastreFeatures = geojsonCadastre.features;
    for (let i = 0; i < cadastreFeatures.length; i++) {
        let bboxCadastre = turf.bbox(cadastreFeatures[i]);
        const found = index.search(bboxCadastre[0], bboxCadastre[1], bboxCadastre[2], bboxCadastre[3]);

        /* La BBOX du batiment du cadastre n'iterscect pas du tout la BBOX des bati OSM */
        if (found.length == 0) {
            newBatiFeatures.push(cadastreFeatures[i])
        } else { // la bbox iDatanterscete au moins un bati OSM
            let maxTxRecouvrement = 0;
            let sumInterscetArea = 0;
            for (let j = 0; j < found.length; j++) {
                let polyInterscet = null
                // console.log(turf.area(cadastreFeatures[i]), turf.area(osmFeatures[found[j]]));
                if (osmFeatures[found[j]].geometry.type === 'Polygon') {
                    const intersection = martinez.intersection(
                        //truncate à 6, sinon martinez peut buguer, on est pas à 10cm pret...
                        turf.truncate(cadastreFeatures[i], truncateOptions).geometry.coordinates,
                        turf.truncate(osmFeatures[found[j]], truncateOptions).geometry.coordinates
                    );
                    if (intersection.length > 0) {
                        if (intersection[0].length > 1) {
                            polyInterscet = turf.multiPolygon(intersection);
                        } else {
                            // intersection = intersection[0];
                            let firstCoords = intersection[0][0][0];
                            let lastCoords = intersection[0][0][intersection[0][0].length - 1];
                            //    console.log(firstCoords, lastCoords);
                               if (firstCoords.toString() === lastCoords.toString()){
                                polyInterscet = turf.polygon(intersection[0]);
                               } else {
                                intersection[0][0].push(firstCoords);
                                polyInterscet = turf.polygon(intersection[0]);
                                   console.log('oups, firstCoords : ', firstCoords, ' lastcoords: ', lastCoords)
                               }
                               
                            
                         
                        }
                    
                    const currentAreaPolygon = turf.area(polyInterscet);
                    sumInterscetArea = sumInterscetArea + currentAreaPolygon;

                    } else {
                        polyInterscet = null;
                    }



                }

                // Si on a au moins une zone commune

                // if (polyInterscet) {
                //     const areaCadastre = turf.area(cadastreFeatures[i]);
                //     const areaIntersec = turf.area(polyInterscet)
                //     const txRecouvrement = areaIntersec / areaCadastre;
                //     if (maxTxRecouvrement < txRecouvrement) {
                //         maxTxRecouvrement = txRecouvrement;
                //     }
                // }
            }

            const areaCadastre = turf.area(cadastreFeatures[i]);
            if (sumInterscetArea == 0) { // => pas de recouvrement
                newBatiFeatures.push(cadastreFeatures[i])
            } else {
                let txRecouvrement = sumInterscetArea / areaCadastre;
                if (txRecouvrement < 0.80) {
                    conflictBati.push(cadastreFeatures[i])
                } else {
                    stableBati.push(cadastreFeatures[i])
                }
    
            }

        }
    }


    // console.log(newBatiFeatures);
    let resultNewBati = turf.featureCollection(newBatiFeatures);
    let resultConflict = turf.featureCollection(conflictBati);
    let resultStable = turf.featureCollection(stableBati);

    return {
        newBati: resultNewBati,
        conflictBati: resultConflict,
        stableBati: resultStable
    }
}

/*
    Retourne un geojson contenant les bati OSM qui n'intersecte pas de batiment du cadastre 
*/
const getOldBuildings = function (geojsonCadastre, geojsonOSM) {
    const osmFeatures = geojsonOSM.features;
    const cadastreFeatures = geojsonCadastre.features
    const index = new Flatbush(cadastreFeatures.length);
    let oldBatiFeatures = []; // bati dans OSM mais sans aucune interscection avec le cadastre

    for (let i = 0; i < cadastreFeatures.length; i++) {
        let bboxCadastreFeature = turf.bbox(cadastreFeatures[i]);
        // console.log(bboxOsmFeature);
        index.add(bboxCadastreFeature[0], bboxCadastreFeature[1], bboxCadastreFeature[2], bboxCadastreFeature[3]);
    }
    index.finish();

    for (let i = 0; i < osmFeatures.length; i++) {
        let bboxOsm = turf.bbox(osmFeatures[i]);
        const found = index.search(bboxOsm[0], bboxOsm[1], bboxOsm[2], bboxOsm[3]);

        /* La BBOX du batiment d'OSM n'iterscect pas du tout la BBOX des bati du cadastre */
        if (found.length == 0) {
            oldBatiFeatures.push(osmFeatures[i])
        } else { // la bbox iDatanterscete au moins un bati OSM
            let maxTxRecouvrement = 0;
            for (let j = 0; j < found.length; j++) {
                let polyInterscet = null
                // console.log(turf.area(cadastreFeatures[i]), turf.area(osmFeatures[found[j]]));
                if (cadastreFeatures[found[j]].geometry.type === 'Polygon' && osmFeatures[i].geometry.type === 'Polygon') {
                    const intersection = martinez.intersection(
                        //truncate à 6, sinon martinez peut buguer, on est pas à 10cm pret...
                        turf.truncate(osmFeatures[i], truncateOptions).geometry.coordinates,
                        turf.truncate(cadastreFeatures[found[j]], truncateOptions).geometry.coordinates
                    );
                    polyInterscet = turf.multiPolygon(intersection);
                }

                // Si on a au moins une zone commune

                if (polyInterscet) {
                    const areaOsm = turf.area(osmFeatures[i]);
                    const areaIntersec = turf.area(polyInterscet)
                    const txRecouvrement = areaOsm / areaIntersec;
                    if (maxTxRecouvrement < txRecouvrement) {
                        maxTxRecouvrement = txRecouvrement;
                    }
                }
            }
            if (maxTxRecouvrement == 0) {
                oldBatiFeatures.push(osmFeatures[i])
            }
        }

    }


    // console.log(newBatiFeatures);
    return turf.featureCollection(oldBatiFeatures);
}

const getGeojsonByStatus = function (geojsonCadastre, geojsonOSM, tx) {
    geojsonCadastre = toOsmAttributs(geojsonCadastre);

    let newBuidings = getNewBuildings(geojsonCadastre, geojsonOSM, tx);
    let oldBuildings = getOldBuildings(geojsonCadastre, geojsonOSM, tx);

    return {
        newBati: newBuidings.newBati,
        conflictBati: newBuidings.conflictBati,
        stableBati: newBuidings.stableBati,
        oldBati: oldBuildings
    }

}

module.exports = getGeojsonByStatus;