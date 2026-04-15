import pytest
from backend.policy.evaluator import PolicyEvaluator

ev = PolicyEvaluator()


def allow(action, resource="*"):
    return {"Statement": [{"Effect": "Allow", "Action": action, "Resource": resource}]}


def deny(action, resource="*"):
    return {"Statement": [{"Effect": "Deny", "Action": action, "Resource": resource}]}


def test_basic_allow():
    assert ev.evaluate("*", "s3:GetObject", "*", [allow("s3:GetObject")]).allowed


def test_basic_deny():
    assert not ev.evaluate("*", "s3:GetObject", "*", [deny("s3:GetObject")]).allowed


def test_wildcard_star():
    assert ev.evaluate("*", "s3:DeleteObject", "*", [allow("s3:*")]).allowed


def test_wildcard_prefix():
    pol = allow("s3:Get*")
    assert ev.evaluate("*", "s3:GetObject", "*", [pol]).allowed
    assert not ev.evaluate("*", "s3:DeleteObject", "*", [pol]).allowed


def test_deny_wins():
    assert not ev.evaluate("*", "s3:DeleteObject", "*",
                           [allow("*"), deny("s3:Delete*")]).allowed


def test_not_action():
    pol = {"Statement": [{"Effect": "Allow", "NotAction": "s3:DeleteObject", "Resource": "*"}]}
    assert ev.evaluate("*", "s3:GetObject", "*", [pol]).allowed
    assert not ev.evaluate("*", "s3:DeleteObject", "*", [pol]).allowed


def test_resource_wildcard():
    pol = allow("s3:GetObject", "arn:aws:s3:::prod-*/*")
    assert ev.evaluate("*", "s3:GetObject", "arn:aws:s3:::prod-data/file.txt", [pol]).allowed
    assert not ev.evaluate("*", "s3:GetObject", "arn:aws:s3:::staging/file", [pol]).allowed


def test_admin_allows_everything():
    admin = allow("*")
    for action in ["s3:DeleteObject", "iam:CreateUser", "ec2:TerminateInstances"]:
        assert ev.evaluate("*", action, "*", [admin]).allowed


def test_no_policies_denies():
    assert not ev.evaluate("*", "s3:GetObject", "*", []).allowed


def test_mfa_condition():
    pol = {"Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*",
           "Condition": {"Bool": {"aws:MultiFactorAuthPresent": "true"}}}]}
    assert ev.evaluate("*", "s3:*", "*", [pol],
                       context={"aws:MultiFactorAuthPresent": "true"}).allowed
    assert not ev.evaluate("*", "s3:*", "*", [pol],
                           context={"aws:MultiFactorAuthPresent": "false"}).allowed


def test_single_statement_as_dict():
    pol = {"Statement": {"Effect": "Allow", "Action": "s3:GetObject", "Resource": "*"}}
    assert ev.evaluate("*", "s3:GetObject", "*", [pol]).allowed


def test_action_as_string():
    pol = {"Statement": [{"Effect": "Allow", "Action": "s3:GetObject", "Resource": "*"}]}
    assert ev.evaluate("*", "s3:GetObject", "*", [pol]).allowed


def test_ifexists_absent_key():
    pol = {"Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*",
           "Condition": {"StringEqualsIfExists": {"aws:RequestedRegion": "ap-south-1"}}}]}
    assert ev.evaluate("*", "s3:GetObject", "*", [pol], context={}).allowed


def test_multiple_conditions_all_must_pass():
    pol = {"Statement": [{"Effect": "Allow", "Action": "*", "Resource": "*",
           "Condition": {
               "Bool": {"aws:MultiFactorAuthPresent": "true"},
               "StringEquals": {"aws:RequestedRegion": "ap-south-1"},
           }}]}
    assert ev.evaluate("*", "s3:GetObject", "*", [pol], context={
        "aws:MultiFactorAuthPresent": "true",
        "aws:RequestedRegion": "ap-south-1",
    }).allowed
    assert not ev.evaluate("*", "s3:GetObject", "*", [pol], context={
        "aws:MultiFactorAuthPresent": "true",
        "aws:RequestedRegion": "us-east-1",
    }).allowed


def test_deny_with_condition():
    pol = {"Statement": [
        {"Effect": "Allow", "Action": "s3:*", "Resource": "*"},
        {"Effect": "Deny", "Action": "s3:DeleteObject", "Resource": "*",
         "Condition": {"StringEquals": {"aws:RequestedRegion": "us-east-1"}}},
    ]}
    assert not ev.evaluate("*", "s3:DeleteObject", "*", [pol],
                           context={"aws:RequestedRegion": "us-east-1"}).allowed
    assert ev.evaluate("*", "s3:DeleteObject", "*", [pol],
                       context={"aws:RequestedRegion": "ap-south-1"}).allowed