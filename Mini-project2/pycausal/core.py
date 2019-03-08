import json
import warnings

import numpy as np
import pandas as pd

from enum import Enum


class MoralGraph:

    def __init__(self, n):
        self.vertices = [{"_id": i, "adj": [], "sp": []} for i in range(n)]

    def add_edge(self, i, j):
        if i < 0 or i >= len(self.vertices) or \
           j < 0 or j >= len(self.vertices):
            raise RuntimeError("vertex index out of bound.")
        self.vertices[i]["adj"].append(j)
        self.vertices[j]["adj"].append(i)

    def triangle(self, i, j):
        if i < 0 or i >= len(self.vertices) or \
           j < 0 or j >= len(self.vertices):
            raise RuntimeError("vertex index out of bound.")
        if i not in self.vertices[j]["adj"] or \
           j not in self.vertices[i]["adj"]:
            return None
        else:
            return list(filter(lambda x: x in self.vertices[j]["adj"],
                               self.vertices[i]["adj"]))

    def boundary(self, i):
        if i < 0 or i >= len(self.vertices):
            raise RuntimeError("vertex index out of bound.")
        return self.vertices[i]["adj"]

    def mark_sp(self, edge_list):
        for ed in edge_list:
            i = ed[0]
            j = ed[1]
            if i < 0 or i >= len(self.vertices) or \
               j < 0 or j >= len(self.vertices):
                raise RuntimeError("vertex index out of bound.")
        for ed in edge_list:
            i = ed[0]
            j = ed[1]
            self.vertices[i]["sp"].append(j)
            self.vertices[j]["sp"].append(i)

    def clear_sp(self):
        for v in self.vertices:
            v["sp"] = []

    def non_sp_links(self):
        links = []
        for v in self.vertices:
            non_sp_adj = filter(lambda x: x not in v["sp"] and v["_id"] < x,
                                v["adj"])
            for i in list(non_sp_adj):
                links.append([v["_id"], i])
        return links


class VertexDataType(Enum):
    Unset, Numeric, Categorical = range(3)


class Vertex(object):
    def __init__(self, id, name, data_type=VertexDataType.Unset):
        if data_type not in VertexDataType:
            raise RuntimeError("Illegal 'data_type'.")

        self.id = id
        self.name = name
        self.data_type = data_type.name

    def __eq__(self, other):
        return self.id == other.id

    def __str__(self):
        return self.brief()

    def brief(self):
        return str(self.id) + ":" + str(self.name)

    def detail(self):
        dt = "[Vertex]"
        for k, v in self.__dict__.items():
            dt += " " + str(k) + ":" + str(v)
        return dt

    def to_json(self, indent=None):
        return json.dumps(self, default=lambda o: o.__dict__, indent=indent)


class EdgeType(Enum):
    Nondirected, Directed = range(2)


class Edge(object):
    def __init__(self, v1, v2, direct_type=EdgeType.Nondirected):
        if v1 is None or v2 is None:
            raise RuntimeError("Must speficy two Vertex.\n")
        if direct_type not in EdgeType:
            raise RuntimeError("'direct_type' must be a member of EdgeType.\n")
        if not isinstance(v1, Vertex):
            raise RuntimeError("'v1' must be an instance of Vertex.\n")
        if not isinstance(v2, Vertex):
            raise RuntimeError("'v2' must be an instance of Vertex.\n")

        self.v1 = v1
        self.v2 = v2
        self.direct_type = direct_type.name

    def __eq__(self, other):
        if self.direct_type != other.direct_type:
            return False
        elif self.direct_type == EdgeType.Nondirected.name:
            return (self.v1 == other.v1 and self.v2 == other.v2) or \
                (self.v1 == other.v2 and self.v2 == other.v1)
        else:
            return self.v1 == other.v1 and self.v2 == other.v2

    def __str__(self):
        return self.brief()

    def reverse(self):
        if self.direct_type == EdgeType.Directed.name:
            t = self.v1
            self.v1 = self.v2
            self.v2 = t
        else:
            warnings.warn("Undirected edge, no reversion.")

    def direct(self, rev=False):
        if self.direct_type == EdgeType.Directed.name:
            warnings.warn("Edge has got directed already.")
            return False
        else:
            if rev:
                t = self.v1
                self.v1 = self.v2
                self.v2 = t
            self.direct_type = EdgeType.Directed.name
            return True

    def brief(self):
        mark = "->-" if self.direct_type == EdgeType.Directed.name else "---"
        return self.v1.brief() + mark + self.v2.brief()

    def detail(self):
        dt = "[Edge]" + self.brief()
        for k, v in self.__dict__.items():
            dt += " " + str(k) + ":" + str(v)
        return dt

    def to_json(self, indent=None):
        obj = {"source": self.v1.id, "target": self.v2.id}
        for k, v in self.__dict__.items():
            if k not in ["v1", "v2"]:
                obj[k] = v
        return json.dumps(obj, default=lambda o: o.__dict__, indent=indent)


class PDAG(object):
    fields = ['title', 'vertices', 'edges', '__idset__']

    def __init__(self, title=""):
        self.title = title
        self.vertices = []
        self.edges = []
        self.__idset__ = set()

    def add_vertex(self, vertex):
        if vertex.id in self.__idset__:
            raise RuntimeError("Vertex already exists in graph.")
        self.vertices.append(vertex)
        self.__idset__.add(str(vertex.id))
        return self

    def append_vertices(self, names):
        i = 0
        for nm in names:
            while str(i) in self.__idset__:
                i += 1
            v = Vertex(i, nm)
            self.vertices.append(v)
            self.__idset__.add(str(v.id))
        return self

    def get_vertex_by_name(self, name):
        for v in self.vertices:
            if v.name == name:
                return v
        return None

    def filter_vertices(self, names):
        self.vertices = [v for v in self.vertices if v.name in names]
        self.edges = [e for e in self.edges
                      if e.v1.name in names and e.v2.name in names]
        return self

    def add_edge(self, id1, id2, direct_type):
        if str(id1) not in self.__idset__ or \
           str(id2) not in self.__idset__:
            raise RuntimeError("Vertex doesn't exist.")
        v1 = None
        v2 = None
        for v in self.vertices:
            if str(v.id) == str(id1):
                v1 = v
            elif str(v.id) == str(id2):
                v2 = v
        self.edges.append(Edge(v1, v2, direct_type))
        return self

    def get_edge(self, name1, name2, get_all=False):
        el = []
        for ed in self.edges:
            if ed.v1.name == name1 and ed.v2.name == name2:
                el.append(ed)
            elif ed.direct_type == EdgeType.Nondirected.name and \
                    ed.v1.name == name2 and \
                    ed.v2.name == name1:
                el.append(ed)
        if get_all:
            return el
        elif len(el) > 0:
            return el[0]
        else:
            return None

    def reverse_edge(self, name1, name2):
        count = 0
        for ed in self.edges:
            if ed.direct_type == EdgeType.Directed.name and \
                    ed.v1.name == name1 and \
                    ed.v2.name == name2:
                ed.reverse()
                count += 1
        if count == 0:
            warnings.warn("No such edge to reverse.")
        return self

    def remove_edge(self, name1, name2):
        el = self.get_edge(name1, name2, "all")
        if len(el) == 0:
            warnings.warn("No such edge to remove.")
            return []
        self.edges = [e for e in self.edges if e not in el]
        return el

    def direct_edge(self, name1, name2):
        count = 0
        for ed in self.edges:
            if ed.direct_type == EdgeType.Nondirected.name:
                if ed.v1.name == name1 and ed.v2.name == name2:
                    ed.direct()
                    count += 1
                elif ed.v1.name == name2 and ed.v2.name == name1:
                    ed.direct(rev=True)
                    count += 1
        if count == 0:
            warnings.warn("No such edge to direct.")
        return self

    @staticmethod
    def from_edge_list(edge_list, nd, labels=[], title=""):
        if len(labels) == 0:
            labels = ["v" + str(i) for i in range(nd)]

        pdag = PDAG(title)
        for i in range(nd):
            pdag.add_vertex(Vertex(i, labels[i]))
        for ed in edge_list["directed"]:
            pdag.add_edge(ed[0], ed[1], EdgeType.Directed)
        for ed in edge_list["undirected"]:
            pdag.add_edge(ed[0], ed[1], EdgeType.Nondirected)

        return pdag

    def brief(self):
        tstr = "[PDAG] " + self.title + "\n"
        vstr = "[Vertices]\n"
        for v in self.vertices:
            vstr += v.brief() + "\n"
        estr = "[Edges]\n"
        for e in self.edges:
            estr += e.brief() + "\n"
        return tstr + vstr + estr

    def __str__(self):
        return self.brief()

    def detail(self):
        tstr = "[PDAG]\n"
        for k, v in self.__dict__.items():
            if k == "models":
                tstr += "# models:" + str(len(v)) + "\n"
            elif k not in ["vertices", "edges", "__idset__"]:
                tstr += str(k) + ":" + str(v) + "\n"
        vstr = "[Vertices]\n"
        for v in self.vertices:
            vstr += v.detail() + "\n"
        estr = "[Edges]\n"
        for e in self.edges:
            estr += e.detail() + "\n"
        return tstr + vstr + estr

    def to_json(self, indent=None):
        nodes = []
        for v in self.vertices:
            nodes.append(v.__dict__)
        links = []
        for e in self.edges:
            obj = {"source": e.v1.id, "target": e.v2.id}
            for k, v in e.__dict__.items():
                if k not in ["v1", "v2"]:
                    obj[k] = v
            links.append(obj)

        obj = {"nodes": nodes, "links": links}
        for k, v in self.__dict__.items():
            if k == "models":
                obj[k] = len(v)
            elif k not in ["vertices", "edges", "__idset__"]:
                obj[k] = v
        return json.dumps(obj, default=lambda o: o.__dict__, indent=indent)

    def to_adj(self, coef=False):
        adj = pd.DataFrame(0,
                           index=[v.name for v in self.vertices],
                           columns=[v.name for v in self.vertices])
        for e in self.edges:
            if e.direct_type == EdgeType.Directed.name:
                adj.loc[e.v1.name, e.v2.name] = 1 \
                        if (not coef) or (not hasattr(e, 'beta')) else e.beta
        return adj

    @staticmethod
    def from_obj(obj):
        pdag = PDAG(obj["title"]) if hasattr(obj, "title") else PDAG()
        for v in obj["nodes"]:
            pdag.add_vertex(Vertex(v["id"], v["name"]))
        for e in obj["links"]:
            direct_type = EdgeType.Directed \
                    if e["direct_type"] == "Directed" else EdgeType.Nondirected
            pdag.add_edge(e["source"], e["target"], direct_type)

        return pdag


class Skeleton(object):

    def __init__(self, n, edges, sepsets, max_order):
        self.n = n
        self.edges = edges
        self.sepsets = sepsets
        self.max_order = max_order

    def __str__(self):
        return str(self.__dict__)

    def __len__(self):
        return len(self.edges)

    def adj_matr(self):
        adj = np.zeros((self.n, self.n))
        for i, j in self.edges:
            adj[i, j] = adj[j, i] = 1
        return adj
