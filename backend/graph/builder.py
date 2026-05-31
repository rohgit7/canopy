# backend/graph/builder.py
import networkx as nx
import logging

from .models import Edge, EdgeType, EDGE_WEIGHTS
from ..extractor.base import Resource, ResourceType

log = logging.getLogger(__name__)

INTERNET_ID = "INTERNET"


class CanopyGraph:

    def __init__(self, customer_id: str):
        self.customer_id = customer_id
        self.G = nx.DiGraph()
        self.resources: dict = {}
        self.edges: list = []

    def add_resource(self, r: Resource):
        self.resources[r.resource_id] = r
        self.G.add_node(r.resource_id, **r.to_dict())

    def add_edge(self, e: Edge):
        if e.source_id not in self.G or e.target_id not in self.G:
            return

        self.edges.append(e)

        self.G.add_edge(
            e.source_id,
            e.target_id,
            weight=e.weight,
            edge_type=e.edge_type.value,
            **e.properties
        )

    def summary(self):
        print(f"Graph: {self.G.number_of_nodes()} nodes, {self.G.number_of_edges()} edges")

        for edge in self.edges:
            s = self.resources.get(edge.source_id)
            t = self.resources.get(edge.target_id)

            print(
                f"{s.name if s else edge.source_id} "
                f"--[{edge.edge_type.value}]--> "
                f"{t.name if t else edge.target_id}"
            )


def build_graph(customer_id: str, resources: list, policies_by_arn: dict = None) -> CanopyGraph:
    graph = CanopyGraph(customer_id)

    for r in resources:
        graph.add_resource(r)

    # Virtual INTERNET node — attacker start point
    graph.add_resource(
        Resource(
            resource_id=INTERNET_ID,
            resource_type=ResourceType.INTERNET,
            name="Internet (Attacker)",
            arn="pseudo:internet",
            region="global",
            account_id="N/A",
            internet_facing=True,
        )
    )

    _add_network_edges(graph, resources)
    _add_iam_edges(graph, resources)
    _add_data_edges(graph, resources)

    if policies_by_arn:
        from .policy_edges import add_policy_edges
        add_policy_edges(graph, resources, policies_by_arn)

    log.info(
        f"Graph: {graph.G.number_of_nodes()} nodes, {graph.G.number_of_edges()} edges"
    )

    return graph


def _add_network_edges(graph, resources):
    for r in resources:
        if r.internet_facing:
            graph.add_edge(
                Edge(
                    INTERNET_ID,
                    r.resource_id,
                    EdgeType.EXPOSES_PORT,
                    EDGE_WEIGHTS[EdgeType.EXPOSES_PORT],
                    {"description": f"Internet can reach {r.name}"}
                )
            )


def _add_iam_edges(graph, resources):
    roles_by_name = {
        r.name: r for r in resources
        if r.resource_type == ResourceType.IAM_ROLE
    }

    roles_by_arn = {
        r.arn: r for r in resources
        if r.resource_type == ResourceType.IAM_ROLE
    }

    for r in resources:

        # EC2 → IAM Role
        if r.resource_type == ResourceType.EC2_INSTANCE:
            rn = r.metadata.get("iam_role_name")

            if rn and rn in roles_by_name:
                graph.add_edge(
                    Edge(
                        r.resource_id,
                        roles_by_name[rn].resource_id,
                        EdgeType.HAS_ROLE,
                        EDGE_WEIGHTS[EdgeType.HAS_ROLE],
                        {"description": f"{r.name} runs as {rn}"}
                    )
                )

        # Lambda → IAM Role
        if r.resource_type == ResourceType.LAMBDA_FUNCTION:
            rn = r.metadata.get("role_name")

            if rn and rn in roles_by_name:
                graph.add_edge(
                    Edge(
                        r.resource_id,
                        roles_by_name[rn].resource_id,
                        EdgeType.HAS_ROLE,
                        EDGE_WEIGHTS[EdgeType.HAS_ROLE],
                        {"description": f"Lambda {r.name} runs as {rn}"}
                    )
                )

        # Role → Role (Assume Role)
        if r.resource_type == ResourceType.IAM_ROLE:
            for principal in r.metadata.get("trust_principals", []):
                src = roles_by_arn.get(principal)

                if src:
                    graph.add_edge(
                        Edge(
                            src.resource_id,
                            r.resource_id,
                            EdgeType.CAN_ASSUME,
                            EDGE_WEIGHTS[EdgeType.CAN_ASSUME],
                            {"description": f"{src.name} can assume {r.name}"}
                        )
                    )


def _add_data_edges(graph, resources):
    for r in resources:
        if (
            r.resource_type == ResourceType.LAMBDA_FUNCTION
            and r.metadata.get("has_suspicious_env")
        ):
            r.is_sensitive = True
            graph.G.nodes[r.resource_id]["is_sensitive"] = True