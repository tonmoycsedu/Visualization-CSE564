var flowLayout = function(width, height) {
    var w = +width,
        h = +height;

    function circular(_nodes) {
        if (!_nodes || _nodes.length == 0) return;

        var c = { x: w / 2, y: h / 2 },
            r = Math.min(c.x, c.y),
            s = Math.PI * 2 / _nodes.length;
        _nodes.forEach((n, i) => {
            var radians = s * i;
            n.x = Math.sin(radians) * r;
            n.y = Math.cos(radians) * -r;
        });
    }

    function _bfs_build_tree(_model) {
        // start from roots of all components
        var queue = _model.nodes.filter(n => n.parents.size == 0);
        if (queue.length == 0) queue = [_model.nodes[0]];
        var visited = new Set(queue.map(v => v.id));
        while (queue.length > 0) { // BFS
            let curr = queue.shift();
            curr.children.forEach(c => {
                if (!visited.has(c.id)) {
                    queue.push(c);
                    visited.add(c.id);
                    c.parent = curr.id; // set parent when first visit a node
                }
            });
            if (queue.length == 0 && visited.size < _model.nodes.length) { // in case of circle
                let next = _model.nodes.find(v => !visited.has(v.id));
                queue.push(next);
                visited.add(next.id);
            }
        }
        // add the extra root to be parent of roots in components
        _model.nodes.forEach(v => {
            if (typeof(v.parent) === "undefined")
                v.parent = -1;
        });
        _model.nodes.push({ "name": "_root", "id": -1, "parent": undefined });
        // _bfs_post_process(_model);
    }

    // function _bfs_post_process(_model) {
    //     var last = new Set([-1]);
    //     while (last.size > 0) {
    //         var curr = new Set(_model.nodes.filter(n => last.has(n.parent)));
    //         if (curr.size >= 3) { // when at least three nodes in the layer
    //             var related_links = _model.links.filter(l => curr.has(l.source) && curr.has(l.target));
    //             if (related_links.length >= 3) {
    //                 var visited = new Set();
    //                 related_links.forEach(l => {
    //                     if (visited.has(l)) return;
    //                     curr.forEach(n => {
    //                         if (n.parents.has(l.source) && n.parents.has(l.target)) {
    //                             n.parent = l.target.id;
    //                             related_links.filter(ll => ll.target == n).forEach(lll => visited.add(lll));
    //                             related_links.filter(ll => ll.source == n).forEach(lll => visited.add(lll));
    //                             visited.add(l);
    //                         } else if ((n.children.has(l.source) && n.children.has(l.target)) ||
    //                             (n.parents.has(l.source) && n.children.has(l.target)) ||
    //                             (n.children.has(l.source) && n.parents.has(l.target))) {
    //                             l.target.parent = l.source.id;
    //                             related_links.filter(ll => ll.target == l.target || ll.source == l.target)
    //                                 .forEach(lll => visited.add(lll));
    //                             related_links.filter(ll => (ll.source = l.source && ll.target == n) ||
    //                                     (ll.target = l.source && ll.source == n))
    //                                 .forEach(lll => visited.add(lll));
    //                         }
    //                     });
    //                 });
    //             }
    //         }
    //         last = new Set();
    //         curr.forEach(n => last.add(n.id));
    //     }
    // }

    function _bfs_mirror(_from, _to) { // copy nodes' locations and depth
        _from.forEach(n => {
            let nd = _to.find(m => m.id == n.id);
            if (nd) {
                nd.x = n.y; // switch x and y back here
                nd.y = n.x;
                nd.depth = n.depth;
            }
        });
    }

    function _bfs_stretch(_model) { // strech nodes to fill the svg
        var _lonely_nds = _model.nodes.filter(n => n.parents.size == 0 && n.children.size == 0),
            _graph_nds = _model.nodes.filter(n => n.parents.size > 0 || n.children.size > 0);

        var _rw = 5, // max number of nodes per line
            _intv = w / _rw,
            _nr = Math.ceil(_lonely_nds.length / _rw),
            _rh = 35,
            _longly_height = _rh * _nr,
            _graph_height = h - _longly_height;
        // position lonely nodes
        _lonely_nds.forEach((n, i) => {
            n.x = (i % _rw) * _intv;
            n.y = _graph_height + Math.floor(i / _rw) * _rh;
        });

        if (_graph_nds.length == 0) return;

        // stretch along x
        var max_dep = d3.max(_graph_nds, n => n.depth),
            col_w = w / max_dep;
        // align nodes in each layer to the left
        for (var i = 1; i <= max_dep; i++) {
            var nds_i = _graph_nds.filter(n => n.depth == i);
            if (nds_i.length) {
                var nds_i_set = new Set(nds_i),
                    min_x = d3.min(nds_i, n => n.x),
                    lks_i = _model.links.filter(l => nds_i_set.has(l.source) && nds_i_set.has(l.target)),
                    topo = _topo_order(nds_i, lks_i),
                    intv_x = col_w / topo.length;
                topo.forEach((l, i) => l.forEach(n => n.x = min_x + i * intv_x))
            }
        }
        // x zoom
        var ext_x = d3.extent(_graph_nds, n => n.x),
            _r = w / (ext_x[1] - ext_x[0]);
        _graph_nds.forEach(n => n.x = (n.x - ext_x[0]) * _r);

        // stretch along y
        let min_y = d3.min(_graph_nds, n => n.y);
        if (Math.abs(min_y - d3.max(_graph_nds, n => n.y)) < 0.001) {
            // in case all nodes have the same y
            _graph_nds.forEach(n => n.y = _graph_height / 2);
        } else {
            // shift along y
            for (var i = 1; i <= max_dep; i++) {
                let nds_i = _graph_nds.filter(n => n.depth == i);
                if (!nds_i.length) continue;
                if (i > 1 && nds_i.length == 1) {
                    nds_i[0].y = d3.mean(_graph_nds.filter(n => n.depth == i - 1 && (n.children.has(nds_i[0]) || n.parents.has(nds_i[0]))), n => n.y);
                } else {
                    let offset = min_y - d3.min(nds_i, n => n.y);
                    nds_i.forEach(n => n.y += offset);
                }
            }
            // y zoom
            let y_ext = d3.extent(_graph_nds, n => n.y),
                m = _longly_height > 0 ? 30 : 0;
            let _ry = (_graph_height - m) / (y_ext[1] - y_ext[0]);
            _graph_nds.forEach(n => n.y = (n.y - y_ext[0]) * _ry);
        }
    }

    function _topo_order(_nodes, _links) {
        var visited = new Set(),
            layers = [];
        while (visited.size < _nodes.length) {
            var tar_set = new Set(_links.map(l => l.target)),
                new_layer = _nodes.filter(n => !visited.has(n) && !tar_set.has(n));
            if (!new_layer.length)
                new_layer = [_nodes.find(n => !visited.has(n))];
            layers.push(new_layer);
            new_layer.forEach(n => visited.add(n));
            _links = _links.filter(l => !visited.has(l.source));
        }
        return layers;
    }

    function bfs(_model) {
        _bfs_build_tree(_model);
        // stratify _nodes with d3 converter
        var root = d3.stratify().id(d => d.id).parentId(d => d.parent)(_model.nodes);
        // layout nodes, reverse width and height to make left-right flow
        var hier = d3.tree().size([1000, 1000]);
        hier(root);
        _bfs_mirror(root.descendants(), _model.nodes);
        _model.nodes = _model.nodes.filter(n => n.id >= 0);
        _bfs_stretch(_model);
    }

    var ly = {
        circular: function(model) {
            circular(model.nodes);
            return ly;
        },
        flow: function(model) {
            bfs(model);
            return ly;
        }
    };

    return ly;
}