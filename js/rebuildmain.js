//when window loads, set map

//set map function
	
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
        .center([-5, 38])
        .rotate([115.55, 0, 0])
        .parallels([29.5, 45.5])
        .scale(2250)
        .translate([width / 2, height / 2]);
    
    //set path
    var path = d3.geoPath()
        .projection(projection);
    
    // clear old
        d3.select(".map").select("g").selectAll("path").remove();
    
        // load data
        
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/up2007.csv") //load csv
        .defer(d3.json, "data/NA.topojson") //load background
        .defer(d3.json, "data/CAcounties.topojson") //load analysis spatial data
        .await(callback);
    
    function callback(error, csvData, country, county){
        
        //place graticule on the map
        setGraticule(map, path);

	var attrArray = ["YEAR","AVG_CARBON_AC_UNADJ", "AVG_DRYBIO_AC_UNADJ", "AVG_VOLCF_AC_UNADJ", "AVGDuff_Depth", "AVGLitter_Depth","Fire"];
        
        //assign expressed val "AVG_VOLCF_AC_UNADJ"
        expressed = attrArray[6];
        

        //translate TopoJSON
        var Country = topojson.feature(country, country.objects.continent_North_America_subunits),
            Counties = topojson.feature(county, county.objects.cb_2015_california_county_20m).features;
        
        //join csv data to GeoJSON
        CountiesData = mergeData(Counties, csvData, attrArray);       
        
        
        //add vector data to map
        var NAm = map.append("path")
            .datum(Country)
            .attr("class", "countries")
            .attr("d", path);
        
        var CaliCounties = map.selectAll(".county")
            .data(CountiesData)
            .enter()
            .append("path")
            .attr(expressed, function(d){
                return "NAME " + d.properties.expressed;
            })
            .attr("d", path);

		//make color scale
        colorScale = makeColorScale(csvData, attrArray, expressed);
			//define colorScale

		//draw choropleth
        CountiesJoin = drawcounties(CountiesData, expressed, colorScale, map, path);

		//outline counties
        CountyLines = drawblockG(Counties, map, path, expressed);
        
        //chart
        setChart(csvData, colorScale, expressed, attrArray);
        
        
        //dropdown
        createDropdown(csvData, attrArray, CountiesData)
        
        

    };//end callback

};//end setmap

//remove elements from an array
function removeElementsWithValue(arr, val) {
var i = arr.length;
while (i--) {
    if (arr[i] === val) {
        arr.splice(i, 1);
    }
}
return arr;
}

//function set graticule
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
};

//define mergedata and append csvdata to county data
function mergeData(geoj, csvd, attribs){
    // append csv attributes to geojson
        for (let i = 0; i < csvd.length; i++) {
            let tblRow = csvd[i]; // get row
            let rowID = tblRow.GEOID; // get row ID
            for (let a = 0; a < geoj.length; a++) {
                let featProperties = geoj[a].properties; // get feature
                let featID = featProperties.GEOID; // get feature ID
                if (featID == rowID) { // on match...
                    attribs.forEach(function (attribs) {
                        let val = parseFloat(tblRow[attribs]); // get attribute
                        featProperties[attribs] = val; // set attribute
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
function makeColorScale(data1, arrayat, expattr){
    // available ranges
    let red = ["#fee5d9","#fcae91","#fb6a4a","#de2d26","#a50f15"];
    let orange = ["#feedde","#fdbe85","#fd8d3c","#e6550d","#a63603"];
    let yellow = ["#E6FF00","#F7BE00","#EC8E00","#DA5700","#AD2700"]
    let green = ["#edf8e9","#bae4b3","#74c476","#31a354","#006d2c"];
    let blue = ["#eff3ff","#bdd7e7","#6baed6","#3182bd","#08519c"];
    let purple = ["#f2f0f7","#cbc9e2","#9e9ac8","#756bb1","#54278f"];
 
    // get color for expressed attr
    let colorArrays = [arrayat[1],red,arrayat[2],orange,arrayat[3],green,
            arrayat[4],blue,arrayat[5],purple,arrayat[6],yellow];
    let chosenColor = colorArrays[colorArrays.indexOf(expattr)+1];

    // d3 scale
    let colorScale = d3.scaleThreshold().range(chosenColor);

    // array of attribute's values
    var domainArray = [];
    for (let i=0; i<data1.length; i++) {
        var val = parseFloat(data1[i][expattr]);
        domainArray.push(val);
        }

    console.log(domainArray);
    
    var alt = domainArray;
    removeElementsWithValue(alt, 0);
        
    // clustering
    var clusters = ss.ckmeans(domainArray, 5);

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
    function choropleth(props, colorScale) {
        let val = parseFloat(props);
        if (val == 0) {
            return "#fcfcfc"
        } else {
            if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        }
        }
    };



//drawing functions
function drawcounties(geojdata, expattr, colorSc, map, path){
    console.log(expattr);
    // draw block groups FILLED
        let blockGroups = map.selectAll(".blockGroups")
            .data(geojdata)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "blockGroups " + d.properties.GEOID;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties[expattr], colorSc);
            })
            .style("fill-opacity", 0.75)
            .style("stroke-opacity", 0);
};

// draw block groups outline
function drawblockG(geoj, map, path, fieldName){
    
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
                setLabel(d.properties,"GEOID");
            })
            .on("mouseout", function(d){
                highlight(d.properties, "GEOID");
                d3.selectAll(".infoLabel").remove();
            })
            .on("mousemove", moveLabel);
};	

function updateDrawFeatures(dataTable, expressed, colorScale){
        let updateBlockGroups = d3.selectAll(".blockGroups")
            .transition()
            .duration(2000)
            .style("fill", function(d){
                return choropleth(d.properties[expressed], colorScale)
            })
            .style("fill-opacity", 0.75)
            .style("stroke-opacity", 0);
    }

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
            case "AVG_CARBON_AC_UNADJ":
                varName = "Average Carbon per Acre";
                varValue = parseInt(props[expressed])+"lbs per acre";
                break;
            case "AVG_DRYBIO_AC_UNADJ":
                varName = "Average Dry Biomass per Acre";
                varValue = parseInt(props[expressed])+"lbs per acre";
                break;
            case "AVG_VOLCF_AC_UNADJ":
                varName = "Average Cubic Feet of Woody Debris per Acre";
                varValue = parseInt(props[expressed])+"ft^3 per acre";
                break;
            case "AVGDuff_Depth":
                varName = "Average Duff Depth";
                varValue = parseInt(props[expressed])+"inches";
                break;
            case "AVGLitter_Depth":
                varName = "Average Litter Depth";
                varValue = parseInt(props[expressed])+"inches";
                break;
            case "AVGLitter_Depth":
                varName = "Average Litter Depth";
                varValue = parseInt(props[expressed])+"inches";
                break;
            case "Fire":
                varName = "Number of Extreme Fires";
                varValue = parseInt(props[expressed])+" in "+props.YEAR;
                break;
        }



        let labelAttribute = "<h3>" + varValue + "</h3><b>" + varName + "</b>";
        let labelTable = varName

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



//big block pf charts
function setChart(csvData, colorScale, expressed, attrArray){
    //chart frame dimensions
    // array of attribute's values
    var domainArray = [];
    for (let i=0; i<csvData.length; i++) {
        var val = parseFloat(csvData[i][expressed]);
        domainArray.push(val);
        }
    
    Maxval = Math.max.apply(Math, domainArray)
    console.log(Maxval)
    
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 400,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);


    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, Maxval]);

    //set bars for each province
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.GEOID;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", function(d){
            highlight(d, "GEOID") 
            //setLabel(d, "GEOID")
        } )
        .on("mousemove", moveLabel)
            .on("mouseout", function(d){
                highlight(d, "GEOID");
                d3.selectAll(".infoLabel").remove();
            });
        
    
    console.log(chartitle(expressed))

    
    //create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 40)
        .attr("y", 40)
        .attr("class", "chartTitle")

    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);
    
    

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
    updateChart(bars, csvData.length, colorScale, csvData, expressed, attrArray);
    
    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);
};


//dropdown menu for attribute selection
function createDropdown(csvData, attrArray, geoj){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData, attrArray, geoj)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

//dropdown change listener handler
function changeAttribute(attribute, csvData, attrArray, geoj){
    //change the expressed attribute
    expressed1 = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData, attrArray, expressed1);
            
    updateDrawFeatures(csvData,expressed1,colorScale);
    
    //recreate chart
    var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed1] - a[expressed1]})
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
        
    

    updateChart(bars, csvData.length, colorScale, csvData, expressed1, attrArray);
    
    

};

//function to position, size, and color bars in chart
function updateChart(bars, n, colorScale, csvData, expressed, attrArray){
    var domainArray = [];
    for (let i=0; i<csvData.length; i++) {
        var val = parseFloat(csvData[i][expressed]);
        domainArray.push(val);
        }
    
    Maxval = Math.max.apply(Math, domainArray)
    console.log(Maxval)
    
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 400,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
    
    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([chartInnerHeight, 0])
        .domain([0, Maxval]);
    
    //create vertical axis generator
    var yAxis = d3.axisLeft()
        .scale(yScale);
    
    // update axis
            d3.selectAll(".axis")
                .attr("transform", "translate("+leftPadding+","+topBottomPadding/2+")")
                .call(yAxis);

    

    
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return colorScale(d[expressed]);
        });
    
    var chartTitle = d3.select(".chartTitle")
        .text(chartitle(expressed) + " per County");
    
};

function chartitle (expressed){ 
        if (expressed.includes("AVG_CARBON_AC_UNADJ")){
                    return 'Average Carbon per Acre'                    
                    }
        else {
        if (expressed.includes("AVG_DRYBIO_AC_UNADJ")) {                   
                    return 'Average Dry Biomass per Acre'                    
                }
            else{
        if (expressed.includes("AVG_VOLCF_AC_UNADJ")) {                   
                    return 'Cubic Feet of Woody Debris per Acre'                    
                }
                else {
        if (expressed.includes("AVGDuff_Depth")) {                   
                    return 'Average Duff Depth'                    
                }
                    else {
        if (expressed.includes("AVGLitter_Depth")) {                   
                    return 'Average Litter Depth'                    
                }
                        else {
        if (expressed.includes("Fire")) {                   
                    return 'Number of severe Fires'                    
                }
    }}}}}};
        
