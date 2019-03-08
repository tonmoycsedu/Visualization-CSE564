    //========== Graph Visualization Components ====================================
    var on_source = true;
    var cg = flowGraph(".causal", {
            "width": 740,
            "height": 542,
            "margin": { left: 50, top: 50, right: 60, bottom: 50 }
        })
        .on("node_dblclick", function(node) {
            if (cg.mode() == "skel") return;
            if (on_source) {
                $source.dropdown("set selected", node.name).trigger("onChange");
                $("#srclabel").text("Source");
                $("#tarlabel").text("Target*");
            } else {
                $target.dropdown("set selected", node.name).trigger("onChange");
                $("#srclabel").text("Source*");
                $("#tarlabel").text("Target");
            }
            on_source = !on_source;
            ac.toggle(node.name);
        })
        .on("edge_dblclick", function(edge) {
            $source.dropdown("set selected", edge.source.name);
            $target.dropdown("set selected", edge.target.name).trigger("onChange");
            ac.open(edge.target.name)
                .highlight(edge.source.name, edge.target.name);
        });

    var sb = scoreBar(".score", {
        "width": 55,
        "height": 500,
        "barHeight": 400
    });

    $("#edgeglyph").checkbox({
        onChange: function() { cg.toggleEdgeGlyph(); }
    });

    $("input[name=coef]").on("input", function() {
        var val = +$(this).val();
        $("#thre").html(val.toFixed(2));
        cg.edgeThreshold(val);
    });

    var $source = $("#source"),
        $target = $("#target");

    $source.dropdown({
        "allowReselection": true,
        "onChange": refresh_buttons
    });
    $target.dropdown({
        "allowReselection": true,
        "onChange": refresh_buttons
    });

    function update_variables(_model) {
        var nodes = _model.nodes.map(function(d) {
            return { "name": d.name, "value": d.name, "text": d.name };
        });

        $source.dropdown("clear");
        $target.dropdown("clear");
        $source.dropdown('setup menu', { values: nodes })
            .dropdown('refresh');
        $target.dropdown('setup menu', { values: nodes })
            .dropdown('refresh');
    }

    function enable_buttons(cre, del, dir, rev) {
        if (cre)
            $("#bcre").removeClass("disabled");
        else
            $("#bcre").addClass("disabled");
        if (del)
            $("#bdel").removeClass("disabled");
        else
            $("#bdel").addClass("disabled");
        if (dir)
            $("#bdir").removeClass("disabled");
        else
            $("#bdir").addClass("disabled");
        if (rev)
            $("#brev").removeClass("disabled");
        else
            $("#brev").addClass("disabled");
    }
    refresh_buttons();

    function refresh_buttons() {
        if (!model.nodes) {
            enable_buttons(false, false, false, false);
            return;
        }
        var src = model.nodes.find(v => v.name == $source.dropdown("get value")),
            tar = model.nodes.find(v => v.name == $target.dropdown("get value")),
            edge = null,
            reverse = null;
        if (!src || !tar || src.id == tar.id) {
            enable_buttons(false, false, false, false);
        } else {
            model.links.forEach(function(e) {
                if ((e.source == src.id && e.target == tar.id) ||
                    (e.direct_type == "Nondirected" &&
                        e.source == tar.id && e.target == src.id)) {
                    edge = e;
                } else if (e.direct_type == "Directed" &&
                    e.source == tar.id && e.target == src.id) {
                    reverse = e;
                }
            });
            if (!edge && !reverse) {
                enable_buttons(true, false, false, false);
            } else if (!edge && reverse) {
                enable_buttons(false, true, false, false);
            } else if (edge.direct_type == "Nondirected") {
                enable_buttons(false, true, true, false);
            } else {
                enable_buttons(false, true, false, true);
            }
        }
    }

    $("#bcre").click(function() {
        var v1 = model.nodes.find(v => v.name == $source.dropdown("get value")),
            v2 = model.nodes.find(v => v.name == $target.dropdown("get value")),
            edge = { "source": v1.id, "target": v2.id, "direct_type": "Directed" };
        model.links.push(edge);
        enable_buttons(false, true, false, true);
        update_active_model(function(m) {
            cg.update($.extend(true, {}, m), cg.mode());
            sb.score(m.score);
            ac.update(v2.name, m)
                .highlight(v1.name, v2.name)
                .open(v2.name);
        });
    });
    $("#bdel").click(function() {
        var v1 = model.nodes.find(v => v.name == $source.dropdown("get value")),
            v2 = model.nodes.find(v => v.name == $target.dropdown("get value"));
        model.links = model.links.filter(function(e) {
            return e.source != v1.id || e.target != v2.id;
        });
        enable_buttons(true, false, false, false);
        update_active_model(function(m) {
            cg.update($.extend(true, {}, m), cg.mode());
            sb.score(m.score);
            ac.update(v2.name, m);
        });
    });
    $("#bdir").click(function() {
        var v1 = model.nodes.find(v => v.name == $source.dropdown("get value")),
            v2 = model.nodes.find(v => v.name == $target.dropdown("get value")),
            edge = model.links.find(function(e) { return e.source == v1.id && e.target == v2.id; });
        edge.direct_type = "Directed";
        enable_buttons(false, true, false, true);
        update_active_model(function(m) {
            cg.update($.extend(true, {}, m), cg.mode());
            sb.score(m.score);
            ac.update(v2.name, m)
                .open(v2.name)
                .highlight(v1.name, v2.name);
        });
    });
    $("#brev").click(function() {
        var v1 = model.nodes.find(v => v.name == $source.dropdown("get value")),
            v2 = model.nodes.find(v => v.name == $target.dropdown("get value")),
            edge = { "source": v2.id, "target": v1.id, "direct_type": "Directed" };
        model.links = model.links.filter(function(e) {
            return e.source != v1.id || e.target != v2.id;
        });
        model.links.push(edge);
        enable_buttons(false, true, false, true);
        update_active_model(function(m) {
            cg.update($.extend(true, {}, m), cg.mode());
            sb.score(m.score);
            ac.update(v1.name, m)
                .update(v2.name)
                .open(v1.name, true)
                .highlight(v2.name, v1.name);
            $source.dropdown("set selected", v2.name);
            $target.dropdown("set selected", v1.name);
        });
    });

    $("#filter").click(() => {
        if (ajaxRunning) return;
        if (model && active_model) {
            active_model.links = active_model.links.filter(l => Math.abs(l.beta) > cg.edgeThreshold());
            model.links = skeleton(active_model).links;
            app.service.fit(active_model, pc.brushedStatus(), scaling)
                .then(res => {
                    active_model = JSON.parse(res.model);
                    cg.update($.extend(true, {}, active_model), cg.mode());
                    sb.base(active_model.score);
                    var mc = max_coef();
                    $("input[name=coef]").attr("max", mc == 0 ? 1 : Math.ceil(mc * 100) / 100).val(0).trigger("input");
                    ac.model(active_model, true);
                    refresh_buttons();
                });
            refresh_buttons();
        }
    });

    $("#refresh").click(() => {
        if (active_model) {
            cg.load($.extend(true, {}, active_model), cg.mode());
        }
    });

    //========== Regression Analysis Components ====================================
    var ac = accordion_generator('.model-table', null);