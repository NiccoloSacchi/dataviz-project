let p, c
c = new CategoryGraph()

function pageInit() {
    d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    c.drawGraph('search-tool', 'data/categories.json', category_callback)
}

function category_callback(url, currHierarchy){
    p = new ProductGraph()
    p.drawGraph('search-tool', 'data/graphs/'+url, currHierarchy, product_callback, true, true, true);
}

function product_callback(currHierarchy) {
    c.drawGraph('search-tool', 'data/categories.json', category_callback, currHierarchy)
}