class CategoryGraph {
    constructor(){
        // default initializations of the parameters (can be changed to modify the graph)
        //this.height = 530;
		this.height = 650;
        this.width = 650      // width will be computer after
        this.node_diameter = [2, 25]; // min and max diameter of the nodes
        this.duration = 350
        this.degrees = 2*Math.PI
        this.choices = []
    }

    drawGraph(divId, file, callback, currHierarchy){
        // callback: function that is called when an leaf category has been selected
        this.callback = callback
        let that = this

        this.tooltip = d3.select(".tooltip")
        if (this.tooltip.empty())
            d3.select("body").append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

        // Load the data, draw the table and start the graph
        d3.json(file, (error, data) => {
            if (error) throw error;

            // let this.pubs = {"names": [""], "children": convert_map(data), 'count': 1, 'isleaf': false};
            this.pubs = data; // store the data in a parameter

            this.i = 0
            this.roots = []

            let curr_root =  d3.hierarchy(this.pubs, (d) => d.children);
            this.roots.push(curr_root);

            let max_count = this.pubs["count"];
            this.diameterScale = d3.scaleLinear()
                .domain([0, Math.sqrt(max_count)])
                .range([this.node_diameter[0], this.node_diameter[1]]);

            // select the div
            let div = d3.select("#"+divId);
            // clear the div content
            div.selectAll("*").remove();

            let table = div.append("div")
                .attr("class", "categories_table")

            // append the search box
            let box = table
                .append("div").attr("class", "topnav")

            box.append("button")
                .attr("class", "btn btn-success btn-back")
                .on("click", () => window.open("./data-viz.html", "_self"))
                .append("i").attr("class", "fa fa-home") //fa-arrow-left

            box = box.append("div").attr("class", "search-container")//.append("form")
            box.append("button").on("click", () => {
                    // start over from the root Amazon
                    that.roots = that.roots.slice(0, 1)
                    let amazon = that.roots[0]
                    amazon.children.forEach(collapse);
                    this.list_view.selectAll("*").remove()
                    this.update(amazon); // update the graph
                    this.appendToList(amazon); // update the list

                    // collect all the intermediate categories down to the selected one
                    let node = that.choices[input.node().value]
                    let roots_reversed = []
                    while(node != amazon) {
                        roots_reversed.push(node)
                        node = node.parent
                    }

                    // simulate the click down the selected one
                    for (let r of roots_reversed.reverse()){
                        that.click(r)
                    }
                })
				.attr("class", "btn btn-success")
                .append("i").attr("class", "fa fa-search")
			
			let input = box.append("input")
                .attr("id", "categorySearchBox")
                .attr("type", "text")
                .attr("placeholder", "Search for a category...")
                .attr("name", "search")

            // give the autocompletion all the splitted names
            this.choices = categories_names(curr_root)
            new autoComplete({
                selector: '#categorySearchBox',
                minChars: 1,
                source: function (term, suggest) {
                    term = term.toLowerCase();
                    let matches = [];
                    let names = Object.keys(that.choices)
                    for (let i = 0; i < names.length; i++) {
                        if (names[i].toLowerCase().indexOf(term) >= 0) {
                            matches.push(names[i]);
                        }
                        if (matches.length >= 10) {
                            break
                        }
                    }
                    suggest(matches);
                }
            });

            let row = table.append("div").attr("id", "wrapper")

            let col = row.append("div").attr("id", "categoryColumn")
			let header = col.append("div").attr("class", "catHeader")
            header.append("h3").text("Selected category")
			header.append("hr").attr("class", "small")
            this.list_view = col.append("div").attr("class", "categoryList").append("ul");

            col = row.append("div").attr("id", "categoryGraphColumn")
			header = col.append("div").attr("class", "catHeader")
            header.append("h1").text("Explore categories")
			header.append("hr").attr("class", "small")
			let svgContainer = col.append("div").attr("class", "svgContainer")
            let svg = svgContainer.append("svg").attr("viewBox", "0 0 " + this.width + " " + this.height)
                .attr("class", "categories_graph")
            svg.append("defs")
                .append("pattern")
                .attr("id", "back_image")
                .attr("x", "0%").attr("y", "0%").attr("height", "100%").attr("width", "100%").attr("viewBox", "0 0 512 512")
                .append("image").attr("x", "0%").attr("y", "0%").attr("height", "512").attr("width", "512").attr("href", "img/back.png")

            this.graph_view = svg.append("g")
                .attr("transform", () => "translate(" + this.width / 2 + "," + (this.height / 2) + ")")

            this.treemap = d3.tree()
                .size([this.degrees, this.width])
                .separation((a, b) => (a.parent == b.parent ? 1 : 10) / a.depth);

            curr_root.x0 = this.height / 2;
            curr_root.y0 = 0;

            curr_root.children.forEach(collapse); // start with all children collapsed
            this.update(curr_root); // update the graph
            this.appendToList(curr_root); // update the list

            if (currHierarchy) {
                for (let i = 0; i < currHierarchy.length-1; i++) {
                    curr_root = curr_root.children.find(n => n.data.names == currHierarchy[i])
                    this.click(curr_root)
                }
            }
        });
    }

    update(source) {
        let that = this
        let curr_root = this.roots[this.roots.length - 1];

        // Assign the x and y position to the nodes
        let root = this.treemap(curr_root);

        // Compute the new tree layout.
        let nodes = root.descendants(),
            links = root.links()

        // Normalize for fixed-depth.
        nodes.forEach((d) => d.y = d == curr_root ? 0 : 100);

        // ****************** Nodes section ***************************
        // Update the nodes...
        let node = this.graph_view.selectAll('g.node')
            .data(nodes, (d) => d.id || (d.id = ++this.i));
        let nodeEnter = node.enter().append('g')
            .attr('cursor', 'pointer')
            .attr('class', (d) => 'node ' + nodeClass(d))
            .attr("transform", (d) => "translate(" + radialPoint(source.x0, source.y0, this.degrees) + ")")
            .on('click', (d) => this.click(d))
            // show the tooltip
            .on("mouseover", (d) => {
                this.tooltip
                    .style("display", "block")
                    .transition()
                    .duration(200)
                    .style("opacity", .9);
                this.tooltip
                    .html(
                        "<span>" + d.data.count.toLocaleString() + " products in this category</span>")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
				if (d.data.url) {
					this.tooltip.html(this.tooltip.html() + "<br /><b>Explore category</b>")
				}
            })
            .on("mouseout", (d) => {
                this.tooltip
                    .style("display", "none")
                    .transition()
                    .duration(500)
                    .style("opacity", 0);
            });

        // Add Circle for the nodes
        nodeEnter.append("circle")
            .attr('r', 1e-6)
            .attr("class", (d) => nodeClass(d))
            // .style("stroke", (d) => this.stroke(d))
            .style("fill", (d) => this.fill_category(d));

        let degrees_half = this.degrees /2
        // Add labels for the nodes
        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d) => d.x < degrees_half ? 6 : -6)
            .html((d) => {
                    let names = d.data.names.split("&")
                    return names.map((name, i) =>
                        "<tspan x='0' dy='" + ((i == 0) ? (-(names.length - 1) * 1.1 / 2 + 0.35) : 1.1) + "em'>" +
                        name +
                        "</tspan>")
                        .join("")
                }
            );

        // UPDATE
        let nodeUpdate = nodeEnter.merge(node);

        // Transition to the proper position for the node
        nodeUpdate.transition()
            .duration(this.duration)
            .attr("transform", (d) => "translate(" + radialPoint(d.x, d.y, this.degrees) + ")");

        // Update the node attributes and style
        nodeUpdate.selectAll("circle")
            .attr("r", (d) => this.diameterScale(Math.sqrt(d.data.count)))
            .attr("class", (d) => nodeClass(d))
            .style("fill", (d) => that.fill_category(d))
            // for the node in the middle show a "back" image
            .filter((d) => d.data.names == curr_root.data.names && d.data.names != "Amazon")
            .style("fill", "")
            .attr("fill", "url(#back_image)");

        // update the text on the new root node
        nodeUpdate.selectAll("text")
            .attr("text-anchor", (d) => d.x < degrees_half ? "start" : "end")
            .attr("transform", (d) =>
                "rotate(" + (d.x < degrees_half ? d.x - degrees_half / 2 : d.x + degrees_half / 2) * 180 / degrees_half + ")" +
                "translate(" + (d.x < degrees_half ? (5+this.diameterScale(Math.sqrt(d.data.count))) : -(5+this.diameterScale(Math.sqrt(d.data.count)))) +")")
            // .style("fill-opacity", 1)
            .attr("class", "") // remove all previous classes (if it was a root before...)
            .filter((d) =>
                // the root note should be represented in the middle, bigger and not rotated
                d.data.names == curr_root.data.names
            )
            .attr("transform", (d) => "rotate(0)translate(0," + (this.diameterScale(Math.sqrt(d.data.count)) + 10 * d.data.names.split("&").length) + ")") //todo?
            .attr("text-anchor", "middle")
            .attr("class", "root_node")

        // Remove any exiting nodes
        let nodeExit = node.exit().transition()
            .duration(this.duration)
            .attr("transform", (d) => "translate(" + radialPoint(source.x, source.y, this.degrees) + ")")
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // ****************** links section ***************************

        // Update the links…
        let link = this.graph_view.selectAll("path.link")
            .data(links, (d) =>  d.id);

        // Enter any new links at the parent's previous position.
        let linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))

        // UPDATE
        let linkUpdate = linkEnter.merge(link)

        // Transition back to the parent element position
        linkUpdate.transition()
            .duration(this.duration)
            .attr("d", d3.linkRadial().angle((d) => d.x).radius((d) => d.y))

        // Remove any exiting links
        let linkExit = link.exit().transition()
            .duration(this.duration)
            .attr("d", d3.linkRadial().angle((d) => source.x0).radius((d) => source.y0))
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function radialPoint(x, y, degrees) {
            let degrees_half = degrees/2;
            return [(y = +y) * Math.cos(x -= degrees_half / 2), y * Math.sin(x)];
        }
    }

    appendToList(d) {
        let that = this

        this.list_view.append("li")
            .style("cursor", "pointer")
            .html("<span>" + d.data.names + "</span>")
            .on("click", () => {
                // delete all the roots up to this one
                that.roots = that.roots.slice(0, that.roots.indexOf(d))
                collapse(d);

                while (that.list_view.select("li:last-child").text() != d.data.names) {
                    that.list_view.select("li:last-child").remove()
                }
                that.list_view.select("li:last-child").remove()

                that.click(d)
            });
    }

    // Toggle children on click.
    click(d) {
        if (!d._children && !d.children) {
            // leaf
            if (this.callback) {
                let curr = d
                let currHierarchy = [d]
                while(curr.parent.data.names != "Amazon" && curr.parent) {
                    curr = curr.parent
                    currHierarchy.push(curr)
                }
                this.callback(d.data.url, currHierarchy.map(n=>n.data.names).reverse()) // pass also the name of the file of the product graph
                this.tooltip
                    .style("display", "none")
                    .transition()
                    .duration(500)
                    .style("opacity", 0);
            }
            return
        }

        if (d.children) {
            if (this.roots.length == 1) {
                // don't collapse the root "amazon"
                return
            }

            // collapse tree
            d._children = d.children;
            d.children = null;

            // restore the "parent" root
            this.roots.pop();

            // remove the last element from the list
            this.list_view.select("li:last-child").remove()
        } else {
            // expand tree
            d.children = d._children;
            d._children = null;

            // this node must be the root now
            // let curr_root = roots[roots.length-1];
            // let new_root = curr_root.children.find(node => ArrayEquals(node.names, d.names))
            this.roots.push(d)

            // show in the list the parent category
            this.appendToList.call(this, d)
        }

        this.update(d);
    }

    fill_category(node) {
        if (!node._children && !node.children) {
            // leaf
            return "#5cb85c";
        }

        if (node._children) { // collapsed
            return "#E0E0E0";
        }

        return "#fff" // expanded
    }
}

function categories_names(tree){
    // note: the map is passed by reference
    let map = {}

    // build a map from the name to the respective node
    function inner(tree, path) {
        let name = tree.data.names
        name = path ? path + " → " + name: name // append the path
        map[name] = tree
        if (tree.children)
            tree.children.forEach(c => inner(c, name))
    }

    tree.children.forEach(c => inner(c, ""))
    // inner(tree, null)

    return map
}

// Collapse nodes
function collapse(d) {
    if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
    }
}

function ArrayEquals (array1, array2) {
    // if the other array is a falsy value, return
    if (!array1 || !array2)
        return false;

    // compare lengths - can save a lot of time
    if (array1.length != array2.length)
        return false;

    for (let i = 0, l = array1.length; i < l; i++) {
        // Check if we have nested arrays
        if (array1[i] instanceof Array && array2[i] instanceof Array) {
            // recurse into the nested arrays
            if (!ArrayEquals(array1[i], array2[i]))
                return false;
        }
        else if (array1[i] != array2[i]) {
            // Warning - two different object instances will never be equal: {x:20} != {x:20}
            return false;
        }
    }
    return true;
}

function nodeClass(node){
    if (isLeaf(node))
        return "leaf"
    if (isCollapsed(node))
        return "ancestors"
    return "expanded"
}

function isLeaf(node){
    return !node._children && !node.children
}

function isCollapsed(node){
    return (node._children)? true : false
}