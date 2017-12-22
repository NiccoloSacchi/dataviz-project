class ProductGraph {
    constructor() {
        // default initializations of the parameters (can be changed to modify the graph)
        // height and width of the whole div
        this.width = d3.select("body").node().getBoundingClientRect().width;
        this.height = "100%"
        this.off = 10;    // cluster hull offset
        this.net = {"nodes":[], "links": [], "cliques": {}};  // all nodes (either products or groups) and links
        this.choices = [];

        this.bestProducts = {"nodes": [], "view": null}
        this.focusednode = d3.select("#asdjhasjdhg") // asin of the highlighted node

        this.brushHeight = 50
        // this.simulation; this.hullg; this.linkg; this.nodeg; these are set at runtime
        this.tooltip = d3.select(".tooltip")
        if (this.tooltip.empty())
            d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

        this.drawHull = (d) =>
            d3.line().curve(d3.curveCardinalClosed.tension(.85))(d.path); // 0.8

		// 6-class RdYlGn diverging pattern (from colorbrewer.org)
        this.redToGreen = [
            "#d73027",
			"#fc8d59",
			"#fee08b",
			"#d9ef8b",
			"#91cf60",
			"#1a9850"
        ]
    }

    drawGraph(divId, file, currHierarchy, searchbox_callback, productWindow, priceBrush, bestProducts){
        // divId: id of the div in which to draw the search bar and the graph
        // file: path to the file containing the graph
        // searchbox_callback: if passed a searchbox will be drawn. searchbox is a function that will be called when "back is pressed"
        // productWindow: boolean to indicate whether reserve part of the div
        //                the details of the mouse-overed product
        // priceBrush: boolean to indicate whether draw a brush to select an
        //             interval of prices
        // bestProducts: boolean to indicate whether show the best products
        //             of the showed graph

        let that = this

        // select the div
        let div = d3.select("#"+divId)
        // clear the div content
        div.selectAll("*").remove();

        if (bestProducts){
            let bestProductDiv = div.append("div")
                .attr("id", "sideNavigation")
                .attr("class","sidenav")
            bestProductDiv.append("a")
                .html("&times;")
                .style("cursor", "pointer")
                .attr("class", "closebtn")
                .on("click", closeNav)
            let title = bestProductDiv.append("h4")
                .text("RECOMMENDATIONS")
                .attr("class", "productSectionTitle")
                .append("hr").attr("class", "small")
            title.style("line-height", title.node().getBoundingClientRect().height+"px")
            this.bestProducts["view"] =
                bestProductDiv
                    .append("div")
                    .attr("class", "best-products")
        }

        let table = div.append("div").attr("class", "products_table")

        if(searchbox_callback) {
            let box = table
                .append("div").attr("class", "topnav")

            box.append("button")
                .attr("class", "btn btn-success btn-back")
                .on("click", () => searchbox_callback(currHierarchy))
                .append("i").attr("class", "fa fa-arrow-left")

            box.append("button").attr("class", "btn btn-success topnav-buttons")
                .text("RECOMMENDATIONS")
                .on("click", openNav)

            box.append("div").attr("class", "category-label")
                .append("label")
                .text(currHierarchy[currHierarchy.length-1])

            box = box.append("div").attr("class", "search-container-small")//.append("form")
			let input
			const btn = box.append("button").on("click", () => this.filterProducts(input.node().value))
				.attr("class", "btn btn-success")
                .append("i").attr("class", "fa fa-search")
            input = box.append("input")
                .attr("id", "productSearchBox")
                .attr("type", "text")
                .attr("placeholder", "Filter products by keyword...")
                .attr("name", "search")
        }

        let graph_view = table.append("div")
            .attr("id", "productGraphColumn")
            // .style("width", productWindow ? "70%":"100%")

        if (productWindow){
            // then create a table, on the left we show the graph
            // on the right the details of the product
            let column = table.append("div")
                .attr("id", "selectionColumn")
            let title = column.append("h4")
                .text("SELECTED PRODUCT")
                .attr("class", "productSectionTitle")
                .append("hr").attr("class", "small")
            title.style("line-height", title.node().getBoundingClientRect().height+"px")
            this.productWindow =
                 column.append("div")
                     .attr("class", "selected-product")
        }

        if (priceBrush){
            let row2 = table
                .append("div").attr("id", "priceBrushDiv")

            row2.append("p").text("Desired price range ($)")
                // .style("margin", "auto")
                .style("text-align", "center")
                .style("margin", "0px")
                .style("margin-top", "4px")
                .style("font-size", "13px")

            this.priceBrush = row2
                .append("svg")
                .attr("class", "priceBrush")
                .attr("height", this.brushHeight)
                .attr('transform', 'translate(-3, 2)')
				
			d3.select(window).on('resize', () => {
				this.updatePriceBrush()
			})
        }

        this.zoom = d3.zoom()
            .on("zoom", () => {
                this.svg.selectAll("g").attr("transform", d3.event.transform);
            })
        // append the svg to draw the graph

        this.svg = graph_view.append("svg")
            .attr("class", "product_graph")
            // set height and width, add zoom and drag
            .call(this.zoom);

        // define arrows markers for graph links (directed edges)
        let defs = this.svg.append('defs');
        let refX_map = {'red': [23, -13], 'black': [33, -23]}
        let opacities = [0.2, 0.7]
        for (let color of ['red', 'black']){
            for (let o=0; o<opacities.length; o++){
                // let a = 'end-arrow-' + color + "-" + opacity
                defs.append('marker')
                    .attr('id', 'end-arrow-' + color + "-opacity" + o)
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', refX_map[color][0])
                    .attr('markerWidth', 5)
                    .attr('markerHeight', 5)
                    .attr('orient', 'auto')
                    .append('svg:path')
                    .attr('d', 'M0,-5L10,0L0,5')
                    .attr('stroke', color)
                    .attr('stroke-opacity', opacities[o])
                    .attr('stroke-width', 3)
                    .attr('fill', 'none')

                defs.append('marker')
                    .attr('id', 'start-arrow-' + color + "-opacity" + o)
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', refX_map[color][1])
                    .attr('markerWidth', 5)
                    .attr('markerHeight', 5)
                    .attr('orient', 'auto')
                    .append('svg:path')
                    .attr('d', 'M10,-5L0,0L10,5')
                    .attr('stroke', color)
                    .attr('stroke-opacity', opacities[o])
                    .attr('stroke-width', 3)
                    .attr('fill', 'none')
            }
        }

        defs.append("pattern")
            .attr("id", "background-star")
            .attr("x", "0%").attr("y", "0%").attr("height", "100%").attr("width", "100%").attr("viewBox", "0 0 512 512")
            .append("image").attr("x", "0%").attr("y", "0%").attr("height", "512").attr("width", "512").attr("href", "img/star.svg")

        // when drawing make the graph appear "smoothly"
        this.svg.attr("opacity", 1e-6)
            .transition()
            .duration(1000)
            .attr("opacity", 1);

        d3.json(file, (error, json) => {
            if (error) throw error;
            // convert the nodes to ProductNode
            this.net.nodes = json.nodes
                .map(n => new ProductNode(n.asin, n.name, n.imUrl, n.price, n.numReviews, n.averageRating, n.helpfulFraction, n.brand, n.salesRankCategory, n.salesRank, n.groups, n.component, n.hashColor));
            this.net.links = json.links
                .map(l => new Link(this.net.nodes[l.source], this.net.nodes[l.target], l.left, l.right));
            // source and target of the link are now pointers to the nodes
            // instead of just numbers

            // detect and store the cliques
            let cm = {} // all cliques map
            this.net.nodes.forEach(n => {
                n.groups.forEach(g => {
                    cm[g] = (cm[g] || [])
                    cm[g].push(n)
                })
            })
            let colId = 0
            for (let clique in cm){
                // we consider as clique only the ones with more that 1 element
                if (cm[clique].length > 1) {
                    this.net.cliques[clique] = {}
                    this.net.cliques[clique]["nodes"] = cm[clique]
                    this.net.cliques[clique]["color"] = d3.schemeCategory10[colId % 10]
                    colId += 1
                }
            }

            this.find_paths(this.net.nodes)

            this.hullg = this.svg.append("g");
            this.linkg = this.svg.append("g");
            this.nodeg = this.svg.append("g");

            let svgsize = this.svg.node().getBoundingClientRect()
            this.simulation = d3.forceSimulation()
                .force("link", d3.forceLink()) //.distance(() => 50)
                .force("charge", d3.forceManyBody())
                .force("center", d3.forceCenter(svgsize.width / 2, svgsize.height / 2))
                .velocityDecay(0.5)
                // regulate the shape of the whole cluster
                .force("x", d3.forceX().strength(.1))
                .force("y", d3.forceY().strength(.2))
                .force("repelForce", d3.forceManyBody().strength(-100))//.distanceMax(50).distanceMin(10));

            that.simulation.on("tick", ticked);
            function ticked() {
                that.linkg
                    .selectAll("line")
                    .attr("x1", (d) => d.source.x)
                    .attr("y1", (d) => d.source.y)
                    .attr("x2", (d) => d.target.x)
                    .attr("y2", (d) => d.target.y);

                that.nodeg.selectAll("circle")
                    .attr("cx", (d) => d.x)
                    .attr("cy", (d) => d.y);

                let hull = that.hullg.selectAll("path.hull")
                if (hull && !hull.empty()) {
                    hull.data(that.convexHulls())
                        .attr("d", that.drawHull);
                }
            }

            // set the color of each node (done only one time, computed splitting the price in quantiles)
            // sort descending prices
            let sorted = this.net.nodes.sort((a, b) => b.price - a.price)
			const bins = this.redToGreen.length
			
			sorted.forEach((product, i) => {
				const t = Math.floor(i / sorted.length * bins) // Uniform quantization
				product.fill_color = this.redToGreen[t]
			});

            this.updateGraph(true);
            this.updatePriceBrush();

            // trigger a mouseover
            this.nodeg.select("circle:first-child").dispatch("mouseover")

            if (searchbox_callback) {
                // give the autocompletion all the splitted names
                that.choices = Array.from(
                    new Set(
                        this.net.nodes.reduce((acc, node) => acc.concat(node.keywords), [])
                    )
                )
                new autoComplete({
                    selector: '#productSearchBox',
                    minChars: 1,
                    source: function (term, suggest) {
                        term = term.toLowerCase();
                        let matches = [];
                        for (let i = 0; i < that.choices.length; i++) {
                            if (that.choices[i].toLowerCase().indexOf(term) >= 0) {
                                matches.push(that.choices[i]);
                            }
                            if (matches.length >= 10) {
                                break
                            }
                        }
                        suggest(matches);
                    }
                });
            }

            // todo
            // this.svg
            //     .call(this.zoom.transform, d3.zoomIdentity
            //         .translate(svgsize.width / 2, svgsize.height / 2)
            //         .scale(2)
            //         .translate(svgsize.width / 2, svgsize.height / 2));

        });
    }

    updateGraph(show_opacity_change) {
        // store the context in a variable to access it in the functions
        let that = this

        // get only the nodes and the links to be shown
        let nodes_show = this.net.nodes.filter(node => node.toBeShown());
        let link_show = this.net.links.filter(link => link.toBeShown());

        if (show_opacity_change) {
            this.linkg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
            this.nodeg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
            this.hullg
                .style("opacity", 0)
                .transition().duration(500)
                .style("opacity", 1)
        }

        let link_selection = this.linkg
            .selectAll("line")
            .data(link_show)
            .style('marker-start', (d) => d.startArrow())
            .style('marker-end', (d) => d.endArrow())
            .style("stroke-opacity", (d) => d.opacity())
        link_selection
            .enter()
            .append("line")
            .attr("class", "link")
            .style('marker-start', (d) => d.startArrow())
            .style('marker-end', (d) => d.endArrow())
            .style("stroke-opacity", (d) => d.opacity())
        link_selection.exit().remove()

        let node_selection = this.nodeg
            .selectAll("circle")
            .data(nodes_show)
        let node_enter = node_selection
            .enter()
            .append("circle")
            .attr("id", (d) => d.asin) // give each node the id of its product
            .attr("class", "node")
            .attr("r", (d) => d.range())
            .style("opacity", 1)
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.stroke(that.net))
            .on("mouseover", (d) => {
                // 1. show the details of the product (either in the selected product window or with the popup)
                if (this.productWindow){
                    this.productWindow.selectAll("*").remove()
                    d.appendTo(
                        this.productWindow,
                        null,
                        d.groups.reduce((acc, group) => this.net.cliques[group]? acc.concat(this.net.cliques[group].nodes):acc, []).filter(n => n!=undefined),
                        (n) => this.updateFocus.call(this, n, true))
                }
                else{
                    let tooltip = d3.select(".tooltip")
                        .style("display", "block")
                        .transition()
                        .duration(200)
                        .style("opacity", .9);
                    tooltip.html(d.createTooltip())
                        .style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.event.pageY - 28) + "px");
                }

                // 2. focus on the node
                this.updateFocus(d, false)
            })
            .on("mouseout", (d) => {
                d3.select(".tooltip")
                    .style("display", "none")
                    .transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .call(d3.drag()
                .on("start", (d) => {
                    if (!d3.event.active) that.simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (d) => {
                    d.fx = d3.event.x;
                    d.fy = d3.event.y;
                })
                .on("end", (d) => {
                    if (!d3.event.active) that.simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }))
        let nodeUpdate = node_enter.merge(node_selection);
        nodeUpdate
            .attr("id", (d) => d.asin)
            .attr("fill", (d) =>d.fill())
            .attr("stroke", (d) => d.stroke(that.net))
            .attr("r", (d) => d.range())
            .style("opacity", 1)

        node_selection.exit().remove()

        this.simulation
            .nodes(nodes_show)

        this.simulation.force("link")
            .links(link_show)

        // increase the strength on the links between nodes belonging to the same cluster
        let str = 1
        this.simulation.force("linkForce",
                d3.forceLink(link_show.filter((l) => l.source.groups.some(g => g in l.target.groups)))
                    .strength(str))

        this.simulation.alphaTarget(0.3).restart()

        let hull_data = this.convexHulls()
        let hull_selection = this.hullg
            .selectAll("path.hull")
            .data(hull_data)
        hull_selection.enter()
            .append("path")
            .attr("class", "hull")
            .attr("d", this.drawHull)
            // .style("fill", (d) => "blue")
            .style("fill", (d) => d.clique.color)
        hull_selection.exit().remove()

        // update the list of best products
        let rank = 1
        // let maxrank = 5 show any rank
        // clear the view
        this.bestProducts["view"].selectAll("*").remove()
        // scan the best products and show only the ones that are represented
        // in the graph
        this.bestProducts["nodes"].forEach(n => {
            if (n.toBeShown()){ // && rank <= maxrank){
                if (rank != 1){
                    this.bestProducts["view"].append("hr")
                }
                n.appendTo(
                    this.bestProducts["view"],
                    rank,
                    n.groups.reduce((acc, group) => this.net.cliques[group]? acc.concat(this.net.cliques[group].nodes):acc, []).filter(n => n!=undefined),
                    (n) => this.updateFocus.call(this, n, true))
                rank++
            }
        }
        )
    }

    convexHulls() {
        // update the hull of each clique
        let hulls = {};
        for (let clique in this.net.cliques) {
            if (this.net.cliques[clique].nodes.every(n => n.toBeShown())) { // only if we show all the graph
                hulls[clique] = hulls[clique] || []
                for (let n of this.net.cliques[clique].nodes) {
                    hulls[clique].push([n.x - this.off, n.y - this.off]);
                    hulls[clique].push([n.x - this.off, n.y + this.off]);
                    hulls[clique].push([n.x + this.off, n.y - this.off]);
                    hulls[clique].push([n.x + this.off, n.y + this.off]);
                }
            }
        }

        // create convex hulls
        let hullset = [];
        for (let clique in hulls) {
            // bind the hull to the respective group
            if (hulls[clique].length > 1)
                hullset.push({"clique": this.net.cliques[clique], "path": d3.polygonHull(hulls[clique])});
        }
        return hullset
    }

    find_paths(nodes) {
        // finds all the paths from the nodes to the node with the higher fan-in

        // Sort nodes by decreasing fan-in minus fan-out
        let best = nodes
            .filter(n => n instanceof ProductNode && n.toBeShown())
            .sort((a, b) => (b.incoming.length - b.neighbours.length) - (a.incoming.length - a.neighbours.length))

        nodes.forEach(n => [n.pred, n.dist, n.assigned] = [null, Infinity, false])

        let queue = []
        best.forEach(n => {
            if (!n.assigned) {
                queue.push(n)
                n.dist = 0
                this.bestProducts["nodes"].push(n)
                n.best = true;
            }
            while (queue.length > 0) {
                let u = queue.shift()
                u.assigned = true
                u.incoming.forEach(v => {
                    if (n.dist + 1 < v.dist) {
                        v.dist = n.dist + 1
                        v.pred = u
                        queue.push(v)
                    }
                })
            }
        })
    }

    filterProducts(keyword){
        function bfs_show(nodes) {
            // the bfs is done considering only the product nodes

            // (unique) list of non-explored neighbours
            let neighbours = Array.from(
                new Set(
                    nodes
                        .reduce((acc, n) => acc.concat(n.neighbours.filter(n => !n.reachable)), [])));
            // set the neighbours as seen
            neighbours.forEach(n => n.reachable = true)
            if (neighbours.length > 0) {
                bfs_show(neighbours)
            }
        }

        if (keyword == ""){
            this.net.nodes.forEach(n => n.reachable = true)
        }
        else {
            // set show to true only the product nodes corresponding with the keyword
            let products = this.net.nodes.filter(n => {
                    //todo change for keywords = array
                    n.reachable = n.keywords.includes(keyword)
                    return n.reachable
                }
            )

            // mark a showable all the reachable nodes
            bfs_show(products)

            // show also the direct "parents"
            this.net.nodes.filter(n => n.reachable)
                .forEach(n => n.incoming.forEach(n => n.reachable=true))
        }

        // restore price inteval
        this.net.nodes.forEach(n => n.in_price_interval=true)

        this.updateGraph(true)
        this.updatePriceBrush()
    }

    updateFocus(newNode, zoom){
        // updates the focus (focus on newNode)
        // newNode: node to focus on
        // zoom: boolean which indicates whether to zoom on that node

        // 1. show shortest path to best product (after hiding the previous one)
        let links = this.linkg.selectAll("line")
        this.net.links.forEach(l => l.path = false)
        let node = newNode
        while (node.pred != null) {
            node.links[node.pred.id()].path = true
            node = node.pred
        }
        links.style("stroke", (d) => (d.path) ? 'red' : '')
            .style("stroke-width", (d) => (d.path) ? '2px' : '1px')
            .style('marker-start', (d) => d.startArrow())
            .style('marker-end', (d) => d.endArrow())
            .style("stroke-opacity", (d) => d.opacity())

        // 2. show which is the focused node (flll it with another color)
        // restore the color of the old focused one
        this.focusednode.attr("fill", (d) => d.fill())
        this.focusednode.attr("stroke", (d) => d.stroke(this.net))
        // focus on the new one
        let asins = this.bestProducts["nodes"].map(n=>n.asin)
        if (asins.includes(newNode.asin))
            this.focusednode = d3.select("circle#" + newNode.asin).attr("stroke", "black")
        else
            this.focusednode = d3.select("circle#" + newNode.asin).attr("fill", "white")

        // 3. possibly zoom on that node
        if (zoom) {
            let svgsize = this.svg.node().getBoundingClientRect()
            // zoom on the new node
            this.svg
                .transition()
                // .delay(500)
                .duration(2000)
                .call(this.zoom.transform, d3.zoomIdentity
                    .translate(svgsize.width / 2, svgsize.height / 2)
                    .scale(2)
                    .translate(-newNode.x, -newNode.y));
        }
    }

    updatePriceBrush(){
        // take only the reachable nodes
        let nodes = this.net.nodes.filter(node => node.reachable);

        let brushWidth = this.priceBrush.node().getBoundingClientRect().width
        let brushHeight = this.priceBrush.node().getBoundingClientRect().height
        let prices = nodes.map(n => n.price)
        let maxPrice = Math.max.apply(null, prices)
        maxPrice = Math.ceil(maxPrice/100)*100 // round to next multiple of 100

        let priceScale = d3.scaleLinear()
            .domain([0, maxPrice]) // min max price
            .rangeRound([0, brushWidth]);

        this.priceBrush.selectAll("g").remove()

        this.priceBrush.append("g").attr("id", "productPrices") // here we will show circles representing the prices

        // add small ticks to x axis
        this.priceBrush.append("g")
            .attr("class", "axis axis--grid")
            .attr("transform", "translate(0," + this.brushHeight + ")")
            .call(d3.axisBottom(priceScale)
                .ticks(100)//(brushWidth, 12)
                .tickSize(-this.brushHeight)
                .tickFormat(() => null))
            .selectAll(".tick")
            .classed("tick--minor", (d) =>  d);

        // add wider ticks with label to x axis
        this.priceBrush.append("g")
            .attr("class", "axis axis--x")
            .call(d3.axisBottom(priceScale)
                    .ticks(10)
                    .tickPadding(0)
            )
            .attr("text-anchor", "middle")
            .selectAll("text")
            .attr("y", this.brushHeight/2)

        // add the rectangle to brush
        this.priceBrush.append("g")
            .attr("class", "brush")
            .attr("opacity", 0.5)
            .call(d3.brushX()
                .extent([[0, 0], [brushWidth, this.brushHeight]])
                .on("end", () => brushended()));

        let price_selection = this.priceBrush.select("g#productPrices")
            .selectAll("circle")
            .data(nodes)
        let price_enter = price_selection
            .enter()
            .append("circle")
            .attr("r", (d) => d.best? 6 : 3)
            .attr("fill", n => n.fill())
            .attr("stroke", "gray")
            .attr('stroke-width', (d) => d.best?0:1)
            .attr('stroke-opacity', 0.3)
            .attr("opacity", 1)
            .attr("cx", (d) => priceScale(d.price))
            .attr("cy", (d) => gaussianRandom(y_start(d), y_end(d)))
        let price_update = price_enter.merge(price_selection);
        price_update
            .attr("cx", (d) => priceScale(d.price))
            .attr("cy", (d) => gaussianRandom(y_start(d), y_end(d)))
        price_selection.exit().remove()

        function y_start(d) {
            return (d.best? brushHeight*0.7: 5)
        }
        function y_end(d){
            return (d.best? brushHeight-5: brushHeight*0.7)
        }

        this.priceBrush.select("g#productPrices")
            .selectAll("circle").sort((x, y) => {
                return x.best > y.best;
            })

        let that = this
        function brushended() {
            if (!d3.event.sourceEvent) return; // Only transition after input.
            if (!d3.event.selection) {
                //empty selections.
                that.net.nodes.forEach(n => n.in_price_interval = true)
            }
            else{
                let price_interval = d3.event.selection.map(priceScale.invert) // map pixels to prices
                that.net.nodes.forEach(n => n.in_price_interval = (price_interval[0] < n.price && price_interval[1] > n.price))
            }

            // obfuscate the nodes based on a price interval
            let minopacity = 0.2
            that.nodeg.selectAll("circle")
                .style("opacity", (n) => n.in_price_interval + minopacity)
            that.linkg.selectAll("line")
                .style('marker-start', (d) => d.startArrow())
                .style('marker-end', (d) => d.endArrow())
                .style("stroke-opacity", (d) => d.opacity())
        }
    }
}

class ProductNode {
    constructor(asin, name, imUrl, price, numReviews, averageRating, helpfulFraction, brand, salesRankCategory, salesRank, groups, component, hashColor){
        this.asin = asin
        this.name = name
        this.groups = groups
        this.imUrl = imUrl
        this.price = price
        this.numReviews = numReviews
        this.averageRating = averageRating
        this.helpfulFraction = helpfulFraction
        this.brand = brand
        this.salesRankCategory = salesRankCategory
        this.salesRank = salesRank
        this.component = component
        this.hashColor = hashColor

        this.keywords = Array.from(
            new Set(
                this.name
                // remove ; , ( ) from keywords
                    .replace(/;|,|\(|\)/g, ' ')
                    .toLowerCase()
                    .split(" ")
                    .filter(s => s != "")
            )
        )

        // reachable and in_price_interval are the two conditions that need to be satisfied in order to show the product
        this.reachable = true
        this.in_price_interval = true

        this.neighbours = []; // list of directly reachable nodes
		this.incoming = []; // list of nodes that point towards this node
		this.links = {};

		this.best = false; // is one of the best product

		this.fill_color = "yellow"; // set from outside depending on which quantile this the price of this product belongs
    }

    createTooltip() {
        // given the node returns the HTML code for the tooltip (shown on mouseover event)
        return this.name
    }

    fill() {
        if (this.best)
            return "url(#background-star)"
        return this.fill_color
    }

    stroke(net){
        // change the stroke color if this node belongs to a clique and all the clique
        // is being shown
        if (this.best)
            return ""
        let cliques_id = this.groups.filter(g => g in net.cliques)
        if (cliques_id.length > 0 && cliques_id.some(c_id => net.cliques[c_id].nodes.every(n => n.toBeShown())))
            return "black"
        return "#555"
    }

    range(){
        if (this.best)
            return 8
        return 4
    }

    toBeShown(){
        return this.reachable //&& this.in_price_interval
    }

    id() {
        return this.groups+"|"+this.name;
    }

    link(){
        return "<a href='https://www.amazon.com/dp/"+ this.asin +"'> url </a>"
    }

    appendTo(div, rank, clique, click){
        // div: d3 selector to which append the info about the product
        // rank: string, int or null. If sepecified, will be appended to the product's title
        // clique: list of competing product
        // click: function called when the user clicks on the div
        // small: bool. Specifies whether the window of the product should be big or small

        div = div.append("div").attr("class", "productCard") // contains both the main product and the competing ones
        let rank_str = rank? rank + ". " : "" // if no rank is passed then don't specify it
        let main = div.append("div").attr("class", "main-product") // contain only the main product
            .on("click", () => click(this))
        main.append("h5")
            .text(rank_str + this.name)
        main.append("div")
            .attr("class", "productImg")
            .append("img")
            .attr("src", this.imUrl)
            .attr("alt", "product image not available")

        this.appendMetadata(main, rank_str)

        // show also the competing products
        if (clique && clique.length > 0){
            let clique_view = div.append("div")
                .attr("class", "competing-products")

            clique_view.append("h5")
                    .text("COMPETING PRODUCTS")
                .append("hr").attr("class", "small")

            clique_view = clique_view
                .append("div")
                .attr("class", "competing-products-view")

            let i = 0
            for (let node of clique){
                if (node != this) {
                    if (i!=0)
                        clique_view
                            .append("hr")
                            .attr("class", "small")
                            .style("max-width","50px")
                            .style("border-width", "2px")
                    node.appendToCompeting(clique_view, click)
                    i++
                }
            }
        }
    }

    appendToCompeting(div, click){
        // div: d3 selector to which append the info about the product
        // click: function called when the user clicks on the div
        
        let main = div.append("div")
            .attr("id", this.asin+"Info")
            .on("click", () => click(this))
        main.append("h6")
            // .on("click", () => window.open('https://www.amazon.com/dp/'+ this.asin))
            .text(this.name)
        main.append("div")
            .attr("class", "productImg")
            .append("img")
            .attr("src", this.imUrl)
            .attr("alt", "product image not available")

        this.appendMetadata(main)
    }

    appendMetadata(main){
        // price
        main.append("h6")
            .attr("class", "metadata")
            .text("Price: ")
            .append("label").text(this.price + " $")

        // amazon link
        main.append("div")
            .attr("class", "amazon-ref")
            .append("h6")
            .attr("class", "metadata")
            .text("View on ")
            .append("a")
            .text("Amazon")
            .on("click", () => window.open('https://www.amazon.com/dp/'+ this.asin))

        // average rating
        let avRating = Math.round(this.averageRating*100)/100
        let rating = main.append("div")
            .attr("class", "rating")
        let n_stars = Math.round(avRating*2)/2;
        let i=0
        for (; i< Math.trunc(n_stars); i++) {
            rating.append("img")
                .attr("class", "star")
                .attr("src", "./img/stars/fullStar.png")
        }
        if (n_stars % 1 != 0){
            i++
            rating.append("img")
                .attr("class", "star")
                .attr("src", "./img/stars/halfStar.png")
        }
        while (i<5){
            i++
            rating.append("img")
                .attr("class", "star empty-star")
                .attr("src", "./img/stars/emptyStar.png")
        }
        rating.append("label").text("("+this.numReviews+")")

        // sales rank
        let strRank
        if (this.salesRank && this.salesRankCategory)
            strRank = this.salesRank + " (" + this.salesRankCategory + ")"
        else
            strRank = "Not available"
        main.append("h6")
            .attr("class", "metadata")
            .text("Sales rank: ")
            .append("label").text(strRank)

    }

}

class Link {
    constructor(source, target, left, right){
        this.source = source; // source node
        this.target = target; // target node
        this.left = left;     // direction of the arrow (bool)
        this.right = right;   // direction of the arrow (bool), the arrow may point in both directions
        this.path = false; // belong to the path to the best product

        // add to each node the pointers to its out links (so that we can efficiently
        // do a BFS on the graph)
        if (this.right) {
            this.source.links[this.target.id()] = this
            this.source.neighbours.push(this.target)
            this.target.incoming.push(this.source)
        }
        if (this.left) {
            this.target.links[this.source.id()] = this
            this.target.neighbours.push(this.source)
            this.source.incoming.push(this.target)
        }
    }

    startArrow(){
        if (this.left){ // there is an arrow
            if (this.source.in_price_interval && this.target.in_price_interval){ // the opacity is high
                return (this.path) ? 'url(#start-arrow-red-opacity1)' : 'url(#start-arrow-black-opacity1)'
            }
            return (this.path) ? 'url(#start-arrow-red-opacity0)' : 'url(#start-arrow-black-opacity0)' // the opacity is low
        }
        return ''
    }

    endArrow(){
        if (this.right){ // there is an arrow
            if (this.source.in_price_interval && this.target.in_price_interval){ // the opacity is high
                return (this.path) ? 'url(#end-arrow-red-opacity1)' : 'url(#end-arrow-black-opacity1)'
            }
            return (this.path) ? 'url(#end-arrow-red-opacity0)' : 'url(#end-arrow-black-opacity0)' // the opacity is low
        }
        return ''
    }

    opacity(){
        return (this.source.in_price_interval && this.target.in_price_interval)? 0.7 : 0.2
    }

    toBeShown() {
        // show this link only if both the nodes are to be shown
        return this.source.toBeShown() && this.target.toBeShown()
    }

    id(){
        let u = this.source.id(),
            v = this.target.id();
        return u + "|" + v;
    }
}

function gaussianRand() {
    let rand = 0;
    for (let i = 0; i < 6; i += 1) {
        rand += Math.random();
    }
    return rand / 6;
}
function gaussianRandom(start, end) {
    return Math.floor(start + gaussianRand() * (end - start + 1));
}

function openNav() {
    document.getElementById("sideNavigation").style.width = "400px";
}

function closeNav() {
    document.getElementById("sideNavigation").style.width = "0";
}