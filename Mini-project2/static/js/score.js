function scoreBar(el, config) {
    var width = +config.width,
        height = +config.height,
        barWidth = +config.barWidth || 20,
        barHeight = +config.barHeight || height,
        range = config.range || [-10, 10],
        positive = config.positive || "#F44336",
        negative = config.negative || "#4CAF50",
        dur = +config.transition || 500,
        base = +config.baseScore || 0,
        delta = 0;

    var svg = d3.select(el).append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(30," + (height - barHeight) / 2 + ")");

    var y = d3.scaleLinear().range([barHeight, 0]).domain(range).clamp(true);
    var axis = d3.axisLeft(y)
        .tickFormat(
            function(d) {
                if (d >= 10) return ">10";
                else if (d <= -10) return "<-10";
                else return d + "";
            })
        .tickSize(2);

    svg.append("g").attr("class", "scoreAxis")
        .style("font-family", "Arial")
        .style("font-size", "8pt")
        .style("shape-rendering", "crispEdges")
        .call(axis);

    svg.append("text")
        .attr("transform", "rotate(-90) translate(-10, -25)")
        .attr("font-family", "Arial")
        .attr("font-size", "9pt")
        .attr("font-weight", "bold")
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("Model Score Variation");

    svg.append("rect")
        .attr("fill", "#BDBDBD")
        .attr("x", 1)
        .attr("y", y(0))
        .attr("width", barWidth)
        .attr("height", 1);

    var tip = svg.append("text")
        .attr("font-family", "'Arial Narrow', Arial, sans-serif")
        .attr("font-size", "8.5pt")
        .attr("font-weight", "100")
        .attr("transform", "translate(1," + (y(0) - 10) + ")")
        .attr("visibility", "hidden");

    var posBar = svg.append("rect")
        .attr("fill", positive)
        .attr("x", 1)
        .attr("y", y(0))
        .attr("width", barWidth)
        .attr("height", 0)
        .on("mouseover", function() { tip.attr("visibility", "none"); })
        .on("mouseout", function() { tip.attr("visibility", "hidden"); });
    var negBar = svg.append("rect")
        .attr("fill", negative)
        .attr("x", 1)
        .attr("y", y(0) + 1)
        .attr("width", barWidth)
        .attr("height", 0)
        .on("mouseover", function() { tip.attr("visibility", "none"); })
        .on("mouseout", function() { tip.attr("visibility", "hidden"); });

    var t = d3.transition().duration(dur);

    function fill(score) {
        delta = score - base;
        if (delta > 0) {
            posBar.transition(t)
                .attr("y", y(delta))
                .attr("height", y(0) - y(delta));
            negBar.transition(t)
                .attr("height", 0);
            tip.attr("transform", "translate(1," + (y(delta) - 2) + ")")
                .attr("fill", positive)
                .text(delta.toFixed(1));
        } else if (delta < 0) {
            posBar.transition(t)
                .attr("y", y(0))
                .attr("height", 0);
            negBar.transition(t)
                .attr("height", y(delta) - y(0));
            tip.attr("transform", "translate(1," + (y(delta) + 10) + ")")
                .attr("fill", negative)
                .text(delta.toFixed(1));
        } else {
            posBar.transition(t)
                .attr("y", y(0))
                .attr("height", 0);
            negBar.transition(t)
                .attr("height", 0);
            tip.attr("transform", "translate(1," + y(0) + ")")
                .attr("fill", "none")
                .text("");
        }
        base = score;

        return my;
    }

    function my() {}

    my.score = fill;

    my.base = function(base_score) {
        if (!arguments.length) return base;
        base = base_score;
        fill(base);
        return my;
    };

    my.delta = function() {
        return delta;
    };

    return my;
}