import type { ComponentType } from "react";
import {
  ArchitectureServiceAmazonAPIGateway,
  ArchitectureServiceAmazonRDS,
  ArchitectureServiceAmazonElastiCache,
  ArchitectureServiceAmazonSimpleQueueService,
  ArchitectureServiceElasticLoadBalancing,
  ArchitectureServiceAmazonCloudFront,
  ArchitectureServiceAmazonCognito,
  ArchitectureServiceAmazonEC2,
  ResourceAmazonSimpleStorageServiceS3Standard,
  ResourceClient,
  ResourceUser,
  ResourceUsers,
} from "aws-react-icons";

type IconComponent = ComponentType<{ size?: number } & Record<string, unknown>>;

type IconMap = ReadonlyMap<string, IconComponent>;

const ICONS: IconMap = new Map<string, IconComponent>([
  ["apigateway", ArchitectureServiceAmazonAPIGateway],
  ["api-gateway", ArchitectureServiceAmazonAPIGateway],
  ["elb", ArchitectureServiceElasticLoadBalancing],
  ["load-balancer", ArchitectureServiceElasticLoadBalancing],
  ["rds", ArchitectureServiceAmazonRDS],
  ["database", ArchitectureServiceAmazonRDS],
  ["elasticache", ArchitectureServiceAmazonElastiCache],
  ["cache", ArchitectureServiceAmazonElastiCache],
  ["sqs", ArchitectureServiceAmazonSimpleQueueService],
  ["queue", ArchitectureServiceAmazonSimpleQueueService],
  ["message-queue", ArchitectureServiceAmazonSimpleQueueService],
  ["s3", ResourceAmazonSimpleStorageServiceS3Standard],
  ["object-store", ResourceAmazonSimpleStorageServiceS3Standard],
  ["cloudfront", ArchitectureServiceAmazonCloudFront],
  ["cdn", ArchitectureServiceAmazonCloudFront],
  ["cognito", ArchitectureServiceAmazonCognito],
  ["auth", ArchitectureServiceAmazonCognito],
  ["ec2", ArchitectureServiceAmazonEC2],
  ["server", ArchitectureServiceAmazonEC2],
  ["service", ArchitectureServiceAmazonEC2],
  ["compute", ArchitectureServiceAmazonEC2],
  ["client", ResourceClient],
  ["user", ResourceUser],
  ["users", ResourceUsers],
]);

export function resolveAwsIconComponent(key: string): IconComponent | null {
  const normalized = normalizeKey(stripPrefix(key));
  return ICONS.get(normalized) ?? null;
}

export function defaultAwsIconKey(nodeType: string): string | null {
  switch (nodeType) {
    case "api-gateway":
      return "apigateway";
    case "load-balancer":
      return "elb";
    case "database":
      return "rds";
    case "cache":
      return "elasticache";
    case "queue":
      return "sqs";
    case "message-queue":
      return "sqs";
    case "server":
      return "ec2";
    case "service":
      return "ec2";
    case "client":
      return "client";
    case "user":
      return "user";
    default:
      return null;
  }
}

function stripPrefix(key: string): string {
  return key.startsWith("aws:") ? key.slice("aws:".length) : key;
}

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
