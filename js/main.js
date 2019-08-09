window.onload = setMap();

function setMap(){
    
    //map frame dimensions
    var width = 500,
        height = 600;
    
    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);
    
    //create Albers equal area conic projection
    var projection = d3.geoAlbers()
        .center([-19.36, 38])
        .rotate([100.00, 0, 0])
        .parallels([29.5, 45.5])
        .scale(2250)
        .translate([width / 2, height / 2]);
    
    //set path
    var path = d3.geoPath()
        .projection(projection);
    
    // clear old
        d3.select(".map").select("g").selectAll("path").remove();
    
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/2007.csv") //load csv
        .defer(d3.json, "data/NA.topojson") //load background
        .defer(d3.json, "data/CAcounties.topojson") //load analysis spatial data
        .await(callback);
    
    function callback(error, csvData, country, county){
        
        //place graticule on the map
        setGraticule(map, path);
        
        //translate TopoJSON
        var Country = topojson.feature(country, country.objects.continent_North_America_subunits),
            Counties = topojson.feature(county, county.objects.cb_2015_california_county_20m).features;
        
        //add vector data to map
        var NAm = map.append("path")
            .datum(Country)
            .attr("class", "countries")
            .attr("d", path);
        
        var CaliCounties = map.selectAll(".county")
            .data(Counties)
            .enter()
            .append("path")
            .attr("GEOID", function(d){
                return "NAME " + d.properties.GEOID;
            })
            .attr("d", path);
        
        //assign expressed val
        expressed = csvData[1]
        
        //make color scale
        colorScale = makeColorScale(csvData, expressed)
        
        //join csv data to GeoJSON enumeration units
        CountiesData = mergeData(Counties, csvData);
        
        //draw chloropleth
        CountiesJoin = drawcounties(CountiesData, map, path);
        
        //outline counties
        CountyLines = drawblockG(Counties, map, path);
        
        // load data
    loadData();
    
    // async/wait function to load data and draw the visualization
    async function loadData() {
        // make viz responsive
        $(window).resize(function(){
            try {
                drawFeatures(csvData, featCABlockGroups, featuresBlockGroups, featuresBasemap, expressed, map, colorScale);
                d3.select(".chart").remove();
                setChart(csvData, colorScale, 0);
            } catch(e) {
                //pass
            }
        });
        
        // var listeners
        $('input[name=groupVariables]').click(function(){
            // get the new and set global vars
            let NameInput = $('input[name=groupVariables]:checked').attr('id');

            // set new expressed var
            switch (NameInput) {
                case "input1":
                    expressed = attrArray[0];
                    $("#chart1Title").text('Average Carbon per Acre');
                    break;
                case "input2":
                    expressed = attrArray[1];
                    $("#chart1Title").text('Average Dry Biomass per Acre');
                    break;
                case "input3":
                    expressed = attrArray[2];
                    $("#chart1Title").text('Average Cubic Feet of Woody Debris per Acre');
                    break;
                case "input4":
                    expressed = attrArray[3];
                    $("#chart1Title").text('Average Duff Depth');
                    break;
                case "input5":
                    expressed = attrArray[4];
                    $("#chart1Title").text('Average Litter Depth');
                    break;
            }

            // redraw the viz
            try {
                // color scale
                let colorScale = makeColorScale(csvData, expressed);
                updateDrawFeatures(csvData, expressed, colorScale);
                setChart(csvData, colorScale, 1);
            } catch(e) {
                //pass
            }
        });
        
        //build viz chart
        coordchart = setChart(csvData, colorScale, map);
    };
        
        
        
        
        
        
    }
    
    
    
    
    
}; //end setmap

function setGraticule(map, path){
    var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude
        
        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
}

//define mergedata and append csvdata to county data
function mergeData(geoj, csvd){
    // append csv attributes to geojson
    var attrArray = ["AVG_CARBON_AC_PLOT", "ABG_DRYBIO_AC_UNADJ", "AVG_VOLCF_AC_UNADJ", "AVGDuff_Depth", "AVGLitter_Depth"];
        for (let i = 0; i < csvd.length; i++) {
            let tblRow = csvd[i]; // get row
            let rowID = tblRow.GEOID; // get row ID
            for (let a = 0; a < geoj.length; a++) {
                let featProperties = geoj[a].properties; // get feature
                let featID = featProperties.GEOID; // get feature ID
                if (featID == rowID) { // on match...
                    attrArray.forEach(function (attr) {
                        let val = parseFloat(tblRow[attr]); // get attribute
                        featProperties[attr] = val; // set attribute
                    });
                }
            }
        }
    return geoj
};

// mouse movements
    function moveLabel(){
        // label width
        let labelWidth = d3.select(".infoLabel")
            .node()
            .getBoundingClientRect()
            .width;

        // mouse coords
        let x1 = d3.event.clientX +10;
        let y1 = d3.event.clientY -75;
        let x2 = d3.event.clientX - labelWidth -10;
        let y2 = d3.event.clientY +25;

        let x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2: x1;
        let y = d3.event.clientY < 150 ? y2 : y1;

        d3.select(".infoLabel")
            .style("left", x + "px")
            .style("top", y + "px");
};

// color scale getter
function makeColorScale(csvd, expattr){
    // available ranges
    let red = ["#fee5d9","#fcae91","#fb6a4a","#de2d26","#a50f15"];
    let orange = ["#feedde","#fdbe85","#fd8d3c","#e6550d","#a63603"];
    let green = ["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"];
    let blue = ["#eff3ff","#bdd7e7","#6baed6","#3182bd","#08519c"];
    let purple = ["#f2f0f7","#cbc9e2","#9e9ac8","#756bb1","#54278f"];

        
    // get color for expressed attr
    let colorArrays = ["AVG_CARBON_AC_PLOT",red,"ABG_DRYBIO_AC_UNADJ",orange,"AVG_VOLCF_AC_UNADJ",green,
            "AVGDuff_Depth",blue,"AVGLitter_Depth",purple];
    let chosenColor = colorArrays[colorArrays.indexOf(expattr)+1];

    // d3 scale
    let colorScale = d3.scaleThreshold().range(chosenColor);

    // array of attribute's values
    let domainArray = [];
    for (let i=0; i<csvd.length; i++) {
        let val = parseFloat(csvd[i][expattr]);
        domainArray.push(val);
    }

    // clustering
    let clusters = ss.ckmeans(domainArray, 5);

    // reset to mins
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });

    // remove first value
    domainArray.shift();

    // last 4 mins to domain
    colorScale.domain(domainArray);
    return colorScale;
};

// color helper
    function chloropleth(props, colorScale) {
        let val = parseFloat(props[expressed]);
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        }
    };

//drawing functions
function drawcounties(geojdata, map, path){
    // draw block groups FILLED
        let blockGroups = map.selectAll(".blockGroups")
            .data(geojdata)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", function(d){
                return "blockGroups bg" + d.properties.GEOID;
            })
            .style("fill", function(d){
                return colorScale(d.properties, colorScale);
            })
            .style("fill-opacity", 0.75)
            .style("stroke-opacity", 0);
}
           
// draw block groups outline
function drawblockG(geoj, map, path){
        let blockGroupsStroke = map.selectAll(".blockGroupsStroke")
            .data(geoj)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", function(d){
                return "blockGroupsStroke bg" + d.properties.GEOID;
            })
            .style("fill-opacity", 0)
            .style("stroke-opacity", 1)
            .on("mouseover", function(d){
                map.selectAll("path").filter(".blockGroupsStroke")
                    .sort(function (a){
                        if (a != d) {
                            return -1;
                        } else {
                            return 1;
                        }
                    });
                highlight(d.properties, "GEOID");
                setLabel(d.properties, "GEOID");
            })
            .on("mouseout", function(d){
                highlight(d.properties, "GEOID");
                d3.selectAll(".infoLabel").remove();
            })
            .on("mousemove", moveLabel);

    };


//big block pf charts
// create coord viz chart
    function setChart(csvd, colorsc, callType){

        // widths
        let leftPad = 25;
        let botPad = 20;
        let w1 = parseInt(d3.select("#coordVizCardContent").style('width'));
        let w2 = parseInt(d3.select("#coordVizCardContent").style('width'))-leftPad-5;
        let h1 = parseInt(d3.select("#coordVizCardContent").style('height'));
        let h2 = parseInt(d3.select("#coordVizCardContent").style('height'))-botPad;

        // calculate range/domains
        let domainBarMin = 0;
        let domainBarMax = 1;
        let domainYAxisMin = 0;
        let domainYAxisMax = 100;
        // y axis
        let yAxis = d3.scaleLinear().range([h2, 0]).domain([domainYAxisMin,domainYAxisMax]);

        // y axis scale
        let yScale = d3.scaleLinear().range([0, (h2)]).domain([domainBarMin,domainBarMax]);

        // declare vars for init/update calls
        let bars;
        let updateBars;
        let chart;

        // process at init or update call
        if (callType == 1) {
            // update
            updateBars = d3.selectAll(".bars")
                .sort(function(a,b){
                    return b[expressed] - a[expressed];
                })
                .transition()
                .delay(function(d, i){
                    return i *20;
                })
                .duration(5)
                .attr("x", function(d, i){
                    return i * (w2 / csvd.length) + leftPad+2;
                })
                .attr("height", function(d){
                    return yScale(parseFloat(d[expressed]));
                })
                .attr("y", function(d){
                    return (h2) - yScale(parseFloat(d[expressed])) + botPad/2;
                })
                .style("fill", function(d){
                    return chloropleth(d, colorsc);
                })
                .style("opacity", 0.75);
            // update axis
            d3.selectAll(".axis")
                .attr("transform", "translate("+leftPad+","+botPad/2+")")
                .call(d3.axisLeft(yAxis));
        } else {
            // init

            // chart container
            chart = panel.append.d3.select("#coordVizCardContent")
                .append("svg")
                .attr("width", w1)
                .attr("height", h1)
                .attr("class", "chart")
                .append("g");

            // bars
            bars = chart.selectAll(".bars")
                .data(csvd)
                .enter()
                .append("rect")
                .sort(function(a,b){
                    return b[expressed]-a[expressed];
                })
                .attr("class", function(d){
                    return "bars bg" + d.GEOID;
                })
                .attr("width", w2 / csvd.length -1)
                .attr("x", function(d, i){
                    return i * (w2 / csvd.length) + leftPad+2;
                })
                .attr("height", function(d){
                    return yScale(parseFloat(d[expressed]));
                })
                .attr("y", function(d){
                    return (h2) - yScale(parseFloat(d[expressed])) + botPad/2;
                })
                .style("fill", function(d){
                    return chloropleth(d, colorsc);
                })
                .style("opacity", 0.75)
                //.on("mouseover", highlight)
                .on("mouseover", function(d) {
                    let map = d3.select("dMap");
                    let idcsvd = d.GEOID;
                    d3.select("dMap").selectAll("path").filter(".blockGroupsStroke")
                        .sort(function (a) {
                            let idBlockGroup = a.properties.GEOID;
                            if (idBlockGroup != idcsvd) {
                                return -1;
                            } else {
                                return 1;
                            }
                        });
                    highlight(d,"GEOID");
                    setLabel(d, "GEOID");
                })
                .on("mouseout", function(d){
                    highlight(d, "GEOID");
                    d3.selectAll(".infoLabel").remove();
                })
                .on("mousemove", moveLabel);

            // axis
            chart.append("g")
                .attr("class", "axis")
                .attr("transform", "translate("+leftPad+","+botPad/2+")")
                .call(d3.axisLeft(yAxis));
        }
    };

// highlight on mouseover
    function highlight(props, fieldName){
        //change stroke
        let selected = d3.selectAll(".bg"+props[fieldName]);
        selected.classed("highlight", !selected.classed("highlight"));
    };


        
// tooltips
    function setLabel(props, fieldName){
        // content
        let varName;
        let varValue;
        switch (expressed) {
            case "AVG_CARBON_AC_PLOT":
                varName = "Average Carbon per Acre";
                varValue = parseInt(props[expressed])+"lbs per acre";
                break;
            case "ABG_DRYBIO_AC_UNADJ":
                varName = "Average Dry Biomass per Acre";
                varValue = parseInt(props[expressed]*100)+"lbs per acre";
                break;
            case "AVG_VOLCF_AC_UNADJ":
                varName = "Average Cubic Feet of Woody Debris per Acre";
                varValue = parseInt(props[expressed]*100)+"ft^3 per acre";
                break;
            case "AVGDuff_Depth":
                varName = "Average Duff Depth";
                varValue = parseInt(props[expressed]*100)+"inches";
                break;
            case "AVGLitter_Depth":
                varName = "Average Litter Depth";
                varValue = parseInt(props[expressed]*100)+"inches";
                break;
            
        }



        let labelAttribute = "<h3>" + varValue + "</h3><b>" + varName + "</b>";

        // div
        let infoLabel = d3.select("body")
            .append("div")
            .attr("class", "infoLabel")
            .attr("id", props[fieldName] + "_label")
            .html(labelAttribute);

        let bgName = infoLabel.append("div")
            .attr("class", "labelName")
            .html("");

    }



