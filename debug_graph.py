import os
from dotenv import load_dotenv
load_dotenv()

import boto3
from backend.extractor.orchestrator import extract_all
from backend.extractor.policies     import PolicyDocExtractor
from backend.graph.builder          import build_graph
from backend.extractor.base         import ResourceType

print("\n=== STEP 1: EXTRACTION ===")
resources = extract_all()

by_type = {}
for r in resources:
    t = r.resource_type.value
    by_type[t] = by_type.get(t, 0) + 1

for t, count in sorted(by_type.items()):
    print(f"  {t}: {count}")

print(f"\n  TOTAL: {len(resources)} resources")

print("\n=== STEP 2: EC2 INSTANCES ===")
ec2s = [r for r in resources if r.resource_type == ResourceType.EC2_INSTANCE]
if not ec2s:
    print("  !! ZERO EC2 instances extracted")
    print("  Check: do you have any running EC2 instances in your account?")
    print("  Check: are the regions in BaseExtractor.REGIONS correct?")
else:
    for r in ec2s:
        print(f"  {r.name} | public_ip={r.metadata.get('public_ip')} | internet_facing={r.internet_facing} | iam_role={r.metadata.get('iam_role_name')}")

print("\n=== STEP 3: LAMBDA FUNCTIONS ===")
lambdas = [r for r in resources if r.resource_type == ResourceType.LAMBDA_FUNCTION]
if not lambdas:
    print("  !! ZERO Lambda functions extracted")
else:
    for r in lambdas:
        print(f"  {r.name} | internet_facing={r.internet_facing} | role={r.metadata.get('role_name')}")

print("\n=== STEP 4: SECURITY GROUPS ===")
sgs = [r for r in resources if r.resource_type == ResourceType.EC2_SG]
if not sgs:
    print("  !! ZERO security groups extracted")
else:
    for r in sgs[:5]:
        print(f"  {r.name} | internet_facing={r.internet_facing} | dangerous={r.metadata.get('dangerous_rules', [])}")

print("\n=== STEP 5: BUILD GRAPH ===")
session    = boto3.Session()
pol_arns   = list(set(arn for r in resources for arn in r.metadata.get("attached_policies", [])))
policies   = PolicyDocExtractor(session).extract_docs(pol_arns)
graph      = build_graph("debug", resources, policies)

print(f"  Nodes: {graph.G.number_of_nodes()}")
print(f"  Edges: {graph.G.number_of_edges()}")

print("\n=== STEP 6: EDGE TYPES ===")
edge_counts = {}
for _, _, data in graph.G.edges(data=True):
    et = data.get("edge_type", "UNKNOWN")
    edge_counts[et] = edge_counts.get(et, 0) + 1
for et, count in sorted(edge_counts.items()):
    print(f"  {et}: {count}")

print("\n=== STEP 7: INTERNET NODE EDGES ===")
if "INTERNET" in graph.G:
    successors = list(graph.G.successors("INTERNET"))
    print(f"  INTERNET node has {len(successors)} outgoing edges")
    for s in successors:
        node = graph.G.nodes[s]
        print(f"    → {node.get('name', s)} ({node.get('resource_type', '?')})")
else:
    print("  !! INTERNET node missing from graph")

print("\n=== STEP 8: NODES IN GRAPH BY TYPE ===")
node_types = {}
for _, data in graph.G.nodes(data=True):
    t = data.get("resource_type", "unknown")
    node_types[t] = node_types.get(t, 0) + 1
for t, count in sorted(node_types.items()):
    print(f"  {t}: {count}")

print("\n=== DONE ===")
