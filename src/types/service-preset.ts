// Service presets — lookup table that deletes configuration.
// Lab manifests say "postgres", the system resolves the full definition.

export type ServicePreset = {
  readonly image: string;
  readonly port: number;
  readonly env: Readonly<Record<string, string>>;
  readonly healthcheck: string;
};

export const SERVICE_PRESETS = {
  postgres: {
    image: "postgres:16-alpine",
    port: 5432,
    env: { POSTGRES_USER: "postgres", POSTGRES_PASSWORD: "postgres" },
    healthcheck: "pg_isready -U postgres",
  },
  redis: {
    image: "redis:7-alpine",
    port: 6379,
    env: {},
    healthcheck: "redis-cli ping",
  },
  rabbitmq: {
    image: "rabbitmq:3-management-alpine",
    port: 5672,
    env: { RABBITMQ_DEFAULT_USER: "guest", RABBITMQ_DEFAULT_PASS: "guest" },
    healthcheck: "rabbitmq-diagnostics -q ping",
  },
  kafka: {
    image: "confluentinc/cp-kafka:7.6.0",
    port: 9092,
    env: {
      KAFKA_BROKER_ID: "1",
      KAFKA_ZOOKEEPER_CONNECT: "zookeeper:2181",
      KAFKA_ADVERTISED_LISTENERS: "PLAINTEXT://localhost:9092",
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1",
    },
    healthcheck:
      "kafka-broker-api-versions --bootstrap-server localhost:9092",
  },
  zookeeper: {
    image: "confluentinc/cp-zookeeper:7.6.0",
    port: 2181,
    env: { ZOOKEEPER_CLIENT_PORT: "2181" },
    healthcheck: "echo ruok | nc localhost 2181",
  },
  mysql: {
    image: "mysql:8-oracle",
    port: 3306,
    env: { MYSQL_ROOT_PASSWORD: "root", MYSQL_DATABASE: "lab" },
    healthcheck: "mysqladmin ping -h localhost",
  },
  mongo: {
    image: "mongo:7",
    port: 27017,
    env: {},
    healthcheck: "mongosh --eval 'db.runCommand(\"ping\").ok'",
  },
  localstack: {
    image: "localstack/localstack:latest",
    port: 4566,
    env: { SERVICES: "s3,sqs,sns,dynamodb,lambda" },
    healthcheck: "curl -f http://localhost:4566/_localstack/health",
  },
  minio: {
    image: "minio/minio:latest",
    port: 9000,
    env: {
      MINIO_ROOT_USER: "minioadmin",
      MINIO_ROOT_PASSWORD: "minioadmin",
    },
    healthcheck: "curl -f http://localhost:9000/minio/health/live",
  },
} as const satisfies Record<string, ServicePreset>;

export type PresetName = keyof typeof SERVICE_PRESETS;
