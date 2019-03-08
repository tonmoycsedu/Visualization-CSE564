function flowGraph(el, config) {
    // configurations
    var width = +config.width,
        height = +config.height,
        margin = config.margin || { left: 50, top: 10, right: 50, bottom: 10 },

        edgeStrokeExtent = config.edgeStrokeExtent || [2, 8],
        edgeGlyphExtent = config.edgeGlyphExtent || [4, 16],
        edgeGlyph = typeof config.edgeGlyph !== "undefined" ? config.edgeGlyph : true,
        edgeThreshold = +config.edgeThreshold || 0,

        nodeFont = config.nodeFont || "Arial Narrow",
        nodeFontSize = config.nodeFontSize || "10pt",
        nodeStrokeExtent = config.nodeStrokeExtent || [1, 6],

        border = typeof config.border !== "undefined" ? config.border : false,

        mode = config.mode || "para"; // or "skel"

    // components
    var svg = d3.select(el).append("svg").attr("class", "--flow-graph")
        .attr("width", width).attr("height", height)
        .style("border", border ? "1px solid grey" : "none")
        .append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")"),
        linkgroup = svg.append("g").attr("class", "linkgroup"),
        nodegroup = svg.append("g").attr("class", "nodegroup"),
        edgegroup = linkgroup.append("g").attr("class", "edges"),
        arrowgroup = linkgroup.append("g").attr("class", "arrows"),
        glyphgroup = linkgroup.append("g").attr("class", "glyphs");

    var dispatch = d3.dispatch("node_dblclick", "edge_dblclick");

    var _model;

    function _trim() { // remove duplicate links in _model
        function linkCompare(a, b) { // compare links by source, then target
            if (a.source.id > b.source.id) {
                return 1;
            } else if (a.source.id < b.source.id) {
                return -1;
            } else {
                if (a.target.id > b.target.id) return 1;
                else if (a.target.id < b.target.id) return -1;
                else return 0;
            }
        }
        _model.links.sort(linkCompare); // sort links
        var i = 1;
        while (i < _model.links.length) { // remove duplicate links
            var curr = _model.links[i],
                prev = _model.links[i - 1];
            if (curr.source.id == prev.source.id && curr.target.id == prev.target.id) {
                var dup = !curr.beta || Math.abs(curr.beta) < Math.abs(prev.beta) ? i : i - 1;
                _model.links.splice(dup, 1);
            } else ++i;
        }
    }

    function _layout() { // layout nodes and links
        // Convert the graph model to a tree structure for d3 layout.
        _model.nodes.forEach(n => {
            n.parents = new Set();
            n.children = new Set();
        });
        _model.links.forEach(l => { // parents and children lists of each node
            l.target.parents.add(l.source);
            l.source.children.add(l.target);
        });

        ////test
        var ly = flowLayout(width - margin.left - margin.right, height - margin.top - margin.bottom);
        if (_model.links.length) {
            ly.flow(_model);
        } else {
            ly.circular(_model);
        }
        console.log(_model);
    }


    function _update(redraw = false, dur = 300) {
        /** Scalers */
        var edgeStrokeScale = d3.scaleLinear().domain([0, 1]).range(edgeStrokeExtent).clamp(true);
        var edgeGlyphScale = d3.scaleLinear().domain([0, 10]).range(edgeGlyphExtent).clamp(true);
        var nodeStrokeScale = d3.scaleLinear().domain([0, 1]).range(nodeStrokeExtent).clamp(true);
        /** Utility functions */
        var hidden = svg.append("text")
            .attr("class", "--hidden")
            .attr("font-family", nodeFont)
            .attr("font-size", nodeFontSize)
            .attr("font-weight", "bold")
            .attr("opacity", "0");

        function renderedTextSize(string) { // size of node box
            hidden = hidden.text(string);
            var bBox = hidden.node().getBBox();
            return {
                width: bBox.width,
                height: bBox.height
            };
        }

        function link_class(d) { // class of link path
            if (d.direct_type === "Nondirected") return "link undir";
            else if (typeof(d.beta) === "undefined" || mode == "skel") return "link dir";
            else if (d.source.data_type == "Categorical" || d.target.data_type == "Categorical") return "link com";
            else return d.beta >= 0 ? "link pos" : "link neg";
        }

        function link_stroke_width(d) { // link stroke width
            var sw;
            if (typeof(d.beta) == "undefined")
                sw = edgeStrokeExtent[0] + 1;
            else
                sw = edgeStrokeScale(Math.abs(d.beta));
            return Math.round(sw) + "px";
        }

        function link_path(d) { // d of link path
            var s, t;
            if ((d.target.x - d.target._size.width / 2) - (d.source.x + d.source._size.width / 2) > 20) {
                // target on the right of source
                s = { "x": d.source.x + d.source._size.width / 2 + 5, "y": d.source.y };
                t = { "x": d.target.x - d.target._size.width / 2 - 5, "y": d.target.y };
            } else if ((d.target.x + d.target._size.width / 2) - (d.source.x - d.source._size.width / 2) < -20) { // target on the left of source
                s = { "x": d.source.x - d.source._size.width / 2 - 5, "y": d.source.y };
                t = { "x": d.target.x + d.target._size.width / 2 + 5, "y": d.target.y };
            } else {
                s = { "x": d.source.x, "y": d.source.y + d.source._size.height * (d.source.y < d.target.y ? .5 : -.5) };
                t = { "x": d.target.x, "y": d.target.y + d.target._size.height * (d.source.y > d.target.y ? .5 : -.5) };
            }
            return "M" + s.x + "," + s.y +
                "C" + (s.x + t.x) / 2 + "," + s.y +
                " " + (s.x + t.x) / 2 + "," + t.y +
                " " + t.x + "," + t.y;
        }

        function arrow_class(d) {
            if (d.direct_type === "Nondirected") return "arrow none";
            else if (typeof(d.beta) === "undefined" || mode == "skel") return "arrow dir";
            else if (d.source.data_type == "Categorical" || d.target.data_type == "Categorical") return "arrow com";
            else return d.beta >= 0 ? "arrow pos" : "arrow neg";
        }

        function arrow_path(d) {
            var _path = edgegroup.select("#l" + d.source.id + "-" + d.target.id).node();
            var len = _path.getTotalLength(),
                pos0 = _path.getPointAtLength(len * 0.45),
                pos1 = _path.getPointAtLength(len * 0.45 + 10),
                angle = Math.atan2(pos1.y - pos0.y, pos1.x - pos0.x),
                dist = 4;
            var p1 = (Math.sin(angle) * dist + pos0.x) + "," + (-Math.cos(angle) * dist + pos0.y),
                p2 = (-Math.sin(angle) * dist + pos0.x) + "," + (Math.cos(angle) * dist + pos0.y);
            return "M" + p1 + "L" + p2 + "L" + pos1.x + "," + pos1.y + "Z";
        }

        function glyph_class(d) {
            if (!edgeGlyph || !d.delta_score || mode == "skel") return "glyph non";
            else return d.delta_score >= 0 ? "glyph pos" : "glyph neg";
        }

        function glyph_path(d) {
            if (d.delta_score && mode != "skel") {
                var s = edgeGlyphScale(Math.abs(d.delta_score)),
                    h = 0.5 * s;
                return d.delta_score < 0 ? ["M", 0, ",", 0, "L", s, ",", 0].join("") : ["M", 0, ",", 0, "L",
                    s, ",", 0, "M", h, ",", -h, "L", h, ",", h
                ].join("");
            } else return "";
        }

        function glyph_transform(d) {
            var _path = edgegroup.select("#l" + d.source.id + "-" + d.target.id).node();
            var len = _path.getTotalLength(),
                pos0 = _path.getPointAtLength(len * 0.6),
                pos1 = _path.getPointAtLength(len * 0.6 + 10),
                angle = Math.atan2(pos1.y - pos0.y, pos1.x - pos0.x),
                dist = edgeGlyphExtent[1];
            var p1 = (Math.sin(angle) * dist + pos0.x) + "," + (-Math.cos(angle) * dist + pos0.y),
                p2 = (-Math.sin(angle) * dist + pos0.x) + "," + (Math.cos(angle) * dist + pos0.y);
            if (-Math.PI / 2 < angle && angle < Math.PI / 2)
                return "translate(" + p1 + ")";
            else return "translate(" + p2 + ")";
        }

        function link_arrow_visibility(d) {
            return typeof(d.beta) === "undefined" || Math.abs(d.beta) > edgeThreshold ? "visible" : "hidden";
        }

        function node_class(d) {
            return "label-bg " + (d.data_type == "Unset" ? "unset" : (d.data_type == "Numeric" ? "num" : "cat"));
        }

        function node_stroke_width(d) {
            var sc;
            if (typeof d.rsquared !== "undefined")
                sc = nodeStrokeScale(d.rsquared);
            else if (typeof d.rsquared_pseudo !== "undefined")
                sc = nodeStrokeScale(d.rsquared_pseudo);
            else
                sc = nodeStrokeExtent[0];
            return Math.round(sc) + "px";
        }

        /** Calculate width of each node */
        _model.nodes.forEach(d => d._size = renderedTextSize(d.name));

        /** Render shapes */
        // links
        var links = edgegroup.selectAll(".link")
            .data(_model.links, l => "l" + l.source.id + "-" + l.target.id);

        var _update = links.attr("class", d => link_class(d))
            .attr("id", function(d) { return "l" + d.source.id + "-" + d.target.id; })
            .transition().duration(dur)
            .attr("stroke-width", d => link_stroke_width(d))
            .attr("d", d => link_path(d))
            .attr("visibility", d => link_arrow_visibility(d));

        var _enter = links.enter().append("path")
            .attr("class", d => link_class(d))
            .attr("id", function(d) { return "l" + d.source.id + "-" + d.target.id; })
            .attr("stroke-width", d => link_stroke_width(d))
            .attr("d", d => link_path(d))
            .attr("visibility", d => link_arrow_visibility(d))
            .on("dblclick", function(d) { dispatch.call("edge_dblclick", this, d); })
            .attr("opacity", 0).transition().duration(dur).attr("opacity", 0.8);

        links.exit()
            .transition().duration(dur).attr("opacity", 0).remove();

        if (redraw) {
            arrowgroup.selectAll("*").remove();
            glyphgroup.selectAll("*").remove();
            _enter.on("end", render_arrow_glyph);
            _update.on("end", render_arrow_glyph);
        } else {
            render_arrow_glyph();
        }

        function render_arrow_glyph(dur = 0) {
            // arrows
            var arrows = arrowgroup.selectAll(".arrow")
                .data(_model.links, l => "a" + l.source.id + "-" + l.target.id);

            arrows.attr("class", d => arrow_class(d))
                .attr("d", d => arrow_path(d))
                .attr("stroke-width", d => link_stroke_width(d))
                .attr("visibility", d => link_arrow_visibility(d));

            arrows.enter().append("path")
                .attr("class", d => arrow_class(d))
                .attr("d", d => arrow_path(d))
                .attr("stroke-width", d => link_stroke_width(d))
                .attr("visibility", d => link_arrow_visibility(d))
                .on("dblclick", function(d) { dispatch.call("edge_dblclick", this, d); })
                .attr("opacity", 0).transition().duration(dur).attr("opacity", 1);

            arrows.exit()
                .transition().duration(dur).attr("opacity", 0).remove();
            // glyphs
            var glyphs = glyphgroup.selectAll(".glyph")
                .data(_model.links, l => "g" + l.source.id + "-" + l.target.id);

            glyphs.attr("class", d => glyph_class(d))
                .attr("transform", d => glyph_transform(d))
                .attr("d", d => glyph_path(d))
                .attr("stroke-width", d => Math.max(2, edgeGlyphScale(Math.abs(d.delta_score)) / 4) + "px")
                .attr("visibility", d => link_arrow_visibility(d));

            glyphs.enter().append("path")
                .attr("class", d => glyph_class(d))
                .attr("transform", d => glyph_transform(d))
                .attr("d", d => glyph_path(d))
                .attr("stroke-width", d => Math.max(2, edgeGlyphScale(Math.abs(d.delta_score)) / 4) + "px")
                .attr("visibility", d => link_arrow_visibility(d))
                .attr("opacity", 0).transition().duration(dur).attr("opacity", 0.8);

            glyphs.exit().transition().duration(dur).attr("opacity", 0).remove();
        }

        // nodes
        var rects = nodegroup.selectAll("rect")
            .data(_model.nodes, d => d.name);

        rects.transition().duration(dur)
            .attr("x", d => d.x - d._size.width / 2 - 5)
            .attr("y", d => d.y - d._size.height / 2 - 2)
            .attr("width", d => d._size.width + 10)
            .attr("height", d => d._size.height + 4)
            .attr("stroke-width", d => node_stroke_width(d));

        rects.enter().append("rect")
            .attr("class", d => node_class(d))
            .attr("x", d => d.x - d._size.width / 2 - 5)
            .attr("y", d => d.y - d._size.height / 2 - 2)
            .attr("width", d => d._size.width + 10)
            .attr("height", d => d._size.height + 4)
            .attr("stroke-width", d => node_stroke_width(d))
            .on("dblclick", function(d) { dispatch.call("node_dblclick", this, d); })
            .call(d3.drag().on("drag", d => on_drag(d)))
            .attr("opacity", 0).transition().duration(dur).attr("opacity", 0.8);
        rects.exit()
            .transition().duration(dur).attr("opacity", 0).remove();
        // labels inside nodes
        var labels = nodegroup.selectAll("text")
            .data(_model.nodes, d => d.name);

        labels.transition().duration(dur)
            .attr("x", d => d.x)
            .attr("y", d => d.y);

        labels.enter().append("text")
            .attr("class", "label")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("dy", ".37em")
            .attr("font-family", nodeFont)
            .attr("font-size", nodeFontSize)
            .attr("font-weight", "bold")
            .attr("opacity", 0).transition().duration(dur).attr("opacity", 0.8)
            .text(d => d.name);
        labels.exit()
            .transition().duration(dur).attr("opacity", 0).remove();

        hidden.remove();

        function on_drag(d) {
            d.x = Math.min(width - margin.left - margin.right, Math.max(0, d3.event.x));
            d.y = Math.min(height - margin.top - margin.bottom, Math.max(0, d3.event.y));
            edgegroup.selectAll(".link").attr("d", l => link_path(l));
            arrowgroup.selectAll(".arrow").attr("d", l => arrow_path(l));
            glyphgroup.selectAll(".glyph").attr("transform", l => glyph_transform(l));
            nodegroup.selectAll(".label-bg")
                .attr("x", d => d.x - d._size.width / 2 - 5)
                .attr("y", d => d.y - d._size.height / 2 - 2);
            nodegroup.selectAll(".label")
                .attr("x", d => d.x)
                .attr("y", d => d.y);
        }
    }

    function my() {}

    my.load = function(model, _mode) {
        // _clear();
        _model = model;
        _model.links.forEach(l => {
            l.source = _model.nodes.find(n => n.id == l.source);
            l.target = _model.nodes.find(n => n.id == l.target);
        });
        _trim();
        _layout();
        if (_mode)
            mode = _mode;
        _update(true);
        return my;
    };

    my.update = function(model, _mode) {
        _model.nodes.forEach(n => {
            var d = model.nodes.find(v => v.id == n.id);
            n.data_type = d.data_type;
            if (typeof(n.rsquared) !== "undefined") n.rsquared = d.rsquared;
            if (typeof(n.rsquared_pseudo) !== "undefined") n.rsquared_pseudo = d.rsquared_pseudo;
        });
        _model.links = model.links;
        _model.links.forEach(l => {
            l.source = _model.nodes.find(n => n.id == l.source);
            l.target = _model.nodes.find(n => n.id == l.target);
        });
        _trim();
        if (_mode)
            mode = _mode;
        mode = _mode;
        _update(false);
        return my;
    };

    my.clear = function() {
        nodegroup.selectAll("*").remove();
        edgegroup.selectAll("*").remove();
        arrowgroup.selectAll("*").remove();
        glyphgroup.selectAll("*").remove();
    };

    my.mode = function(_mode) {
        if (!arguments.length) return mode;
        else mode = _mode;
        _update(false);
        return my;
    };

    my.edgeThreshold = function(threshold) {
        if (!arguments.length) return edgeThreshold;
        edgeThreshold = Math.max(0, threshold);
        _update();
        return my;
    };

    my.toggleEdgeGlyph = function(show) {
        if (!arguments.length)
            edgeGlyph = !edgeGlyph;
        else
            edgeGlyph = show ? true : false;
        if (_model) _update();
        return my;
    };

    my.toggleBorder = function(show) {
        if (!arguments.length)
            border = !border;
        else
            border = show ? true : false;
        d3.select(el).select(".--flow-graph")
            .style("border", border ? "1px solid grey" : "none");
        return my;
    };

    my.on = function on(typename, callback) {
        dispatch.on(typename, callback);
        return my;
    };

    return my;
};