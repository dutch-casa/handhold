import type { ComponentType } from "react";
import {
  ArchitectureGroupVirtualprivatecloudVPC,
  ArchitectureServiceAmazonAPIGateway,
  ArchitectureServiceAmazonCloudFront,
  ArchitectureServiceAmazonCloudWatch,
  ArchitectureServiceAmazonCognito,
  ArchitectureServiceAmazonDynamoDB,
  ArchitectureServiceAmazonEC2,
  ArchitectureServiceAmazonElastiCache,
  ArchitectureServiceAmazonElasticContainerRegistry,
  ArchitectureServiceAmazonElasticContainerService,
  ArchitectureServiceAmazonElasticKubernetesService,
  ArchitectureServiceAmazonEventBridge,
  ArchitectureServiceAmazonKinesis,
  ArchitectureServiceAmazonRDS,
  ArchitectureServiceAmazonRoute53,
  ArchitectureServiceAmazonSimpleNotificationService,
  ArchitectureServiceAmazonSimpleQueueService,
  ArchitectureServiceAWSFargate,
  ArchitectureServiceAWSIdentityandAccessManagement,
  ArchitectureServiceAWSLambda,
  ArchitectureServiceAWSSecretsManager,
  ArchitectureServiceAWSStepFunctions,
  ArchitectureServiceAWSWAF,
  ArchitectureServiceElasticLoadBalancing,
  ResourceAlert,
  ResourceAmazonSimpleStorageServiceS3Standard,
  ResourceClient,
  ResourceCredentials,
  ResourceDisk,
  ResourceDocument,
  ResourceEmail,
  ResourceFirewall,
  ResourceFolder,
  ResourceGear,
  ResourceGenericApplication,
  ResourceGitRepository,
  ResourceGlobe,
  ResourceInternet,
  ResourceLogs,
  ResourceMetrics,
  ResourceMobileclient,
  ResourceShield,
  ResourceSourceCode,
  ResourceSSLpadlock,
  ResourceUser,
  ResourceUsers,
} from "aws-react-icons";

type IconComponent = ComponentType<{ size?: number } & Record<string, unknown>>;

type IconMap = ReadonlyMap<string, IconComponent>;

const ICONS: IconMap = new Map<string, IconComponent>([
  // Existing services
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

  // Additional AWS services
  ["lambda", ArchitectureServiceAWSLambda],
  ["function", ArchitectureServiceAWSLambda],
  ["dynamodb", ArchitectureServiceAmazonDynamoDB],
  ["sns", ArchitectureServiceAmazonSimpleNotificationService],
  ["route53", ArchitectureServiceAmazonRoute53],
  ["dns", ArchitectureServiceAmazonRoute53],
  ["cloudwatch", ArchitectureServiceAmazonCloudWatch],
  ["monitoring", ArchitectureServiceAmazonCloudWatch],
  ["step-functions", ArchitectureServiceAWSStepFunctions],
  ["kinesis", ArchitectureServiceAmazonKinesis],
  ["stream", ArchitectureServiceAmazonKinesis],
  ["iam", ArchitectureServiceAWSIdentityandAccessManagement],
  ["secrets-manager", ArchitectureServiceAWSSecretsManager],
  ["eventbridge", ArchitectureServiceAmazonEventBridge],
  ["waf", ArchitectureServiceAWSWAF],
  ["fargate", ArchitectureServiceAWSFargate],
  ["eks", ArchitectureServiceAmazonElasticKubernetesService],
  ["ecs", ArchitectureServiceAmazonElasticContainerService],
  ["ecr", ArchitectureServiceAmazonElasticContainerRegistry],
  ["container-registry", ArchitectureServiceAmazonElasticContainerRegistry],
  ["vpc", ArchitectureGroupVirtualprivatecloudVPC],
  ["network", ArchitectureGroupVirtualprivatecloudVPC],

  // Generic resources
  ["internet", ResourceInternet],
  ["globe", ResourceGlobe],
  ["mobile", ResourceMobileclient],
  ["phone", ResourceMobileclient],
  ["email", ResourceEmail],
  ["mail", ResourceEmail],
  ["firewall", ResourceFirewall],
  ["lock", ResourceSSLpadlock],
  ["ssl", ResourceSSLpadlock],
  ["shield", ResourceShield],
  ["document", ResourceDocument],
  ["file", ResourceDocument],
  ["folder", ResourceFolder],
  ["gear", ResourceGear],
  ["settings", ResourceGear],
  ["logs", ResourceLogs],
  ["metrics", ResourceMetrics],
  ["code", ResourceSourceCode],
  ["source-code", ResourceSourceCode],
  ["git-repo", ResourceGitRepository],
  ["app", ResourceGenericApplication],
  ["application", ResourceGenericApplication],
  ["alert", ResourceAlert],
  ["credentials", ResourceCredentials],
  ["disk", ResourceDisk],
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
