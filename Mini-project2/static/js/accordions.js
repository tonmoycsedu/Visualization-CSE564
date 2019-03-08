function _table(el, columns, data, selectable, color) {
    var table = d3.select(el).append("table")
        .attr("class", "ui celled fluid very compact small table");
    if (selectable) {
        $(table.node()).addClass("selectable");
    }
    if (color && color.length) {
        $(table.node()).addClass(color);
    }
    table.style("font-family", "Arial")
        .style("font-size", "12px");

    table.append('thead').append('tr')
        .selectAll('th')
        .data(columns).enter()
        .append('th')
        .text(function(d) { return d.head; });

    table.append('tbody')
        .selectAll('tr')
        .data(data).enter()
        .append('tr')
        .attr("id", function(d) { return "row-" + d.name; })
        .selectAll('td')
        .data(function(row, i) {
            // evaluate column objects against the current row
            return columns.map(function(c) {
                var cell = {};
                d3.keys(c).forEach(function(k) {
                    cell[k] = typeof c[k] == 'function' ? c[k](row, i) : c[k];
                });
                return cell;
            });
        }).enter()
        .append('td')
        .html(function(d) { return d.html; });
}

function modelTable(el, model, node) {
    var columns = [];
    if (node.model_type == "linear") {
        columns.push({
            head: "r^2",
            html: function(r) { return r.rsquared.toFixed(3); }
        }, {
            head: "r^2 adj.",
            html: function(r) { return r.rsquared_adj.toFixed(3); }
        }, {
            head: "F stat.",
            html: function(r) { return r.fvalue.toFixed(3); }
        }, {
            head: "p-value",
            html: function(r) { return r.f_pvalue.toFixed(3); }
        });
    } else {
        columns.push({
            head: "Pseudo r^2",
            html: function(r) { return r.rsquared_pseudo.toFixed(3); }
        }, {
            head: "LLR",
            html: function(r) { return r.llr.toFixed(3); }
        }, {
            head: "p-value",
            html: function(r) { return r.llr_pvalue.toFixed(3); }
        });
    }

    columns.push({
        head: "BIC",
        html: function(r) { return r.model_score.toFixed(2); }
    });

    var color = node.data_type == "Numeric" ? "blue" : "yellow";
    _table(el, columns, [node], false, color);
}

function coeffTable(el, model, node) {

    var columns = [{
            head: "Name",
            html: function(r) { return r.name; }
        }, {
            head: "coef",
            html: function(r) { return r.beta.toFixed(3); }
        }, {
            head: "Std. Error",
            html: function(r) { return r.se.toFixed(3); }
        }, {
            head: "t stat.",
            html: function(r) { return r.tvalue.toFixed(3); }
        }, {
            head: "p-value",
            html: function(r) { return r.pvalue.toFixed(3); }
        },
        {
            head: "Delta BIC",
            html: function(r) {
                if (r.delta_score)
                    return r.delta_score.toFixed(2);
                else return "";
            }
        }
    ];

    if (node.model_type == "linear" || node.model_type == "logit") {
        var rows = [{
            "name": "const",
            "beta": node.const.beta,
            "se": node.const.se,
            "tvalue": node.const.tvalue,
            "pvalue": node.const.pvalue
        }];
        var color = node.data_type == "Numeric" ? "blue" : "yellow";
        node.causes.forEach(function(cause) {
            var causeNode = model.nodes.find(function(d) { return d.name == cause; });
            if (causeNode.data_type == "Numeric") {
                var edge = model.links.find(function(e) {
                    return e.source == causeNode.id && e.target == node.id;
                });
                rows.push({
                    "name": cause,
                    "beta": edge.beta,
                    "se": edge.se,
                    "tvalue": edge.tvalue,
                    "pvalue": edge.pvalue,
                    "delta_score": edge.delta_score
                });
            } else {
                var edges = model.links.filter(function(e) {
                    return e.source == causeNode.id && e.target == node.id;
                });
                edges.forEach(function(e) {
                    rows.push({
                        "name": cause + "[" + e.level + "]",
                        "beta": e.beta,
                        "se": e.se,
                        "tvalue": e.tvalue,
                        "pvalue": e.pvalue,
                        "delta_score": e.delta_score
                    });
                });
            }
        });
        _table(el, columns, rows, true, color);
    } else {
        node.levels.forEach(function(l, i) {
            if (i == 0) return;
            d3.select(el).append('label')
                .attr("class", "ui sub header")
                .text(node.name + "[" + l + "]");

            var rows_l = [{
                "name": "const",
                "beta": node.const[l].beta,
                "se": node.const[l].se,
                "tvalue": node.const[l].tvalue,
                "pvalue": node.const[l].pvalue
            }];
            node.causes.forEach(function(cause) {
                var causeNode = model.nodes.find(function(d) { return d.name == cause; });
                if (causeNode.data_type == "Numeric") {
                    var edge = model.links.find(function(e) {
                        return e.source == causeNode.id && e.target == node.id &&
                            e.tar_level == l;
                    });
                    rows_l.push({
                        "name": cause,
                        "beta": edge.beta,
                        "se": edge.se,
                        "tvalue": edge.tvalue,
                        "pvalue": edge.pvalue,
                        "delta_score": edge.delta_score
                    });
                } else {
                    var edges = model.links.filter(function(e) {
                        return e.source == causeNode.id && e.target == node.id &&
                            e.tar_level == l;
                    });
                    edges.forEach(function(e) {
                        rows_l.push({
                            "name": cause + "[" + e.level + "]",
                            "beta": e.beta,
                            "se": e.se,
                            "tvalue": e.tvalue,
                            "pvalue": e.pvalue,
                            "delta_score": e.delta_score
                        });
                    });
                }
            });
            _table(el, columns, rows_l, true, color);
        });
    }

}

function makeTable(el, model, vname) {
    var node = model.nodes.find(function(d) { return d.name == vname; });
    if (!node.causes.length) return;
    d3.select(el).selectAll("*").remove();
    modelTable(el, model, node);
    coeffTable(el, model, node);
}

function accordion_generator(el, model) {

    var accordion = d3.select(el).append("div")
        .attr("class", "ui accordion");

    var mod = model,
        open = {};

    function make_accordion() {
        if (!mod || !mod.nodes || !mod.nodes.length) return;
        accordion.selectAll("*").remove();
        open = {};

        mod.nodes.forEach(function(node) {
            if (node.causes.length) {
                var title = accordion.append("div")
                    .attr("class", "title")
                    .attr("data-node-name", node.name);
                title.append("i")
                    .attr("class", "dropdown icon");
                title.append("text")
                    .text(node.name);

                accordion.append("div").attr("class", "content")
                    .attr("data-node-name", node.name)
                makeTable(el + " .content[data-node-name='" + node.name + "']", mod, node.name);

                open[node.name] = false;
            }
        });

        $(".ui.accordion", el).accordion({
            onOpen: function() {
                open[$(this).attr("data-node-name")] = true;
            },
            onClose: function() {
                open[$(this).attr("data-node-name")] = false;
                $("tr", this).removeClass("warning");
            },
            "exclusive": false
        });
    }
    make_accordion();

    function get_index(name) {
        var t = $(el + " .title[data-node-name='" + name + "']");
        return $(el + " .title").index(t);
    };

    function my() {}

    my.model = function(model, redraw, opens, closes) {
        mod = model;
        make_accordion();

        var opened = redraw ? [] : d3.keys(open).filter(d => open[d]);
        if (opens && opens.length) {
            opens.forEach(function(d) {
                if (opened.indexOf(d) < 0) opened.push(d);
            });
        }
        if (closes && closes.length) {
            closes.forEach(function(d) {
                var i = opened.indexOf(d);
                if (i > 0) opened.splice(i, 1);
            });
        }
        opened.forEach(d => {
            $(el + " .ui.accordion div[data-node-name='" + d + "']").addClass("active");
            open[d] = true;
        });
        return my;
    };

    my.update = function(name, model) {
        if (model)
            mod = model;
        var node = mod.nodes.find(v => v.name == name);
        if (node) {
            if ($(el + " .title[data-node-name='" + name + "']").length) {
                if (node.causes.length > 0) {
                    makeTable(el + " .content[data-node-name='" + name + "']", mod, name)
                } else {
                    $(el + " .ui.accordion div[data-node-name='" + name + "']").remove();
                    delete open[name];
                }
            } else {
                var title = accordion.append("div")
                    .attr("class", "title")
                    .attr("data-node-name", name);
                title.append("i")
                    .attr("class", "dropdown icon");
                title.append("text")
                    .text(name);

                accordion.append("div").attr("class", "content")
                    .attr("data-node-name", name)
                makeTable(el + " .content[data-node-name='" + name + "']", mod, name);
            }
        }
        return my;
    }

    my.clear = function() {
        accordion.selectAll("*").remove();
        return my;
    };

    my.open = function(name, force) {
        var idx = get_index(name);
        if (idx >= 0) {
            if (force)
                $("div[data-node-name='" + name + "']", el).addClass("active");
            else
                $(".ui.accordion", el).accordion("open", idx);
        }
        return my;
    };

    my.toggle = function(name) {
        var idx = get_index(name);
        if (idx >= 0) {
            if (open[name])
                $(".ui.accordion", el).accordion("close", idx);
            else
                $(".ui.accordion", el).accordion("open", idx);
        }
        return my;
    };

    my.toggleHighlight = function(src, tar) {
        var row = $("tr[id^='row-" + src + "']", el + " .content[data-node-name='" + tar + "']");
        if (!row)
            return;
        if (row.hasClass("warning"))
            row.removeClass("warning");
        else
            row.addClass("warning");
        return my;
    };

    my.highlight = function(src, tar) {
        var row = $("tr[id^='row-" + src + "']", el + " .content[data-node-name='" + tar + "']");
        if (row && !row.hasClass("warning")) {
            row.addClass("warning");
        }
        return my;
    }

    return my;
}