// LabServicePicker — grid of service presets + active service list.
// Top: preset grid (postgres, redis, mysql, mongo, rabbitmq, kafka).
// Bottom: added services with editable name/image/port and remove button.
// Wired to LabEditorStore for addService, removeService, updateService.

import { useLabEditor } from "@/editor/viewmodel/lab-editor-store";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditableLab, EditableService } from "@/editor/model/types";

// ── Helpers ────────────────────────────────────────────────────

function findLabForStep(stepId: string): EditableLab | undefined {
  const course = useCourseEditorStore.getState().course;
  if (!course) return undefined;
  const step = course.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "lab") return undefined;
  return step.lab;
}

// ── Preset definitions ────────────────────────────────────────

type ServicePreset = {
  readonly name: string;
  readonly image: string;
  readonly port: number;
  readonly hostPort: number;
  readonly env: Record<string, string>;
  readonly healthcheck: string;
  readonly icon: string;
};

const SERVICE_PRESETS: readonly ServicePreset[] = [
  {
    name: "postgres",
    image: "postgres:16-alpine",
    port: 5432,
    hostPort: 5432,
    env: { POSTGRES_PASSWORD: "postgres", POSTGRES_DB: "lab" },
    healthcheck: "pg_isready -U postgres",
    icon: "PG",
  },
  {
    name: "redis",
    image: "redis:7-alpine",
    port: 6379,
    hostPort: 6379,
    env: {},
    healthcheck: "redis-cli ping",
    icon: "RD",
  },
  {
    name: "mysql",
    image: "mysql:8",
    port: 3306,
    hostPort: 3306,
    env: { MYSQL_ROOT_PASSWORD: "mysql", MYSQL_DATABASE: "lab" },
    healthcheck: "mysqladmin ping -h localhost",
    icon: "MY",
  },
  {
    name: "mongo",
    image: "mongo:7",
    port: 27017,
    hostPort: 27017,
    env: {},
    healthcheck: "mongosh --eval 'db.runCommand(\"ping\")'",
    icon: "MG",
  },
  {
    name: "rabbitmq",
    image: "rabbitmq:3-management-alpine",
    port: 5672,
    hostPort: 5672,
    env: {},
    healthcheck: "rabbitmq-diagnostics -q ping",
    icon: "RQ",
  },
  {
    name: "kafka",
    image: "confluentinc/cp-kafka:7.6.0",
    port: 9092,
    hostPort: 9092,
    env: {},
    healthcheck: "kafka-topics --bootstrap-server localhost:9092 --list",
    icon: "KF",
  },
] as const;

// ── PresetCard ────────────────────────────────────────────────

type PresetCardProps = {
  readonly preset: ServicePreset;
  readonly disabled: boolean;
  readonly onAdd: (service: EditableService) => void;
};

function PresetCard({ preset, disabled, onAdd }: PresetCardProps) {
  return (
    <button
      type="button"
      className="press focus-ring flex min-h-[44px] flex-col items-center justify-center gap-sp-1 rounded-md border border-border bg-secondary p-sp-3 text-foreground hover:border-primary/50 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      aria-label={`Add ${preset.name} service`}
      onClick={() => {
        onAdd({
          name: preset.name,
          image: preset.image,
          port: preset.port,
          hostPort: preset.hostPort,
          env: { ...preset.env },
          healthcheck: preset.healthcheck,
        });
      }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted font-mono text-ide-xs font-bold text-primary">
        {preset.icon}
      </span>
      <span className="text-ide-2xs font-medium">{preset.name}</span>
    </button>
  );
}

// ── ServiceRow ────────────────────────────────────────────────

type ServiceRowProps = {
  readonly service: EditableService;
  readonly onUpdate: (name: string, patch: Partial<EditableService>) => void;
  readonly onRemove: (name: string) => void;
};

function ServiceRow({ service, onUpdate, onRemove }: ServiceRowProps) {
  return (
    <div className="flex flex-col gap-sp-2 rounded-md border border-border bg-secondary p-sp-3">
      <div className="flex items-center justify-between">
        <span className="text-ide-sm font-semibold text-foreground">{service.name}</span>
        <button
          type="button"
          className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-2 text-ide-xs text-destructive hover:bg-destructive/10"
          aria-label={`Remove ${service.name}`}
          onClick={() => { onRemove(service.name); }}
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-3 gap-sp-2">
        <label className="flex flex-col gap-sp-1">
          <span className="text-ide-2xs text-muted-foreground">Name</span>
          <input
            type="text"
            className="focus-ring min-h-[44px] rounded-sm border border-border bg-background px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground"
            value={service.name}
            onChange={(e) => { onUpdate(service.name, { name: e.target.value }); }}
            aria-label={`${service.name} service name`}
          />
        </label>
        <label className="flex flex-col gap-sp-1">
          <span className="text-ide-2xs text-muted-foreground">Image</span>
          <input
            type="text"
            className="focus-ring min-h-[44px] rounded-sm border border-border bg-background px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground"
            value={service.image}
            onChange={(e) => { onUpdate(service.name, { image: e.target.value }); }}
            aria-label={`${service.name} docker image`}
          />
        </label>
        <label className="flex flex-col gap-sp-1">
          <span className="text-ide-2xs text-muted-foreground">Port</span>
          <input
            type="number"
            className="focus-ring min-h-[44px] rounded-sm border border-border bg-background px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground tabular-nums"
            value={service.port}
            onChange={(e) => {
              const port = parseInt(e.target.value, 10);
              if (!Number.isNaN(port)) {
                onUpdate(service.name, { port });
              }
            }}
            aria-label={`${service.name} port`}
          />
        </label>
      </div>
    </div>
  );
}

// ── LabServicePicker ──────────────────────────────────────────

type LabServicePickerProps = {
  readonly stepId: string;
};

export function LabServicePicker({ stepId }: LabServicePickerProps) {
  const lab = findLabForStep(stepId);
  if (!lab) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground">Lab not found</span>
      </div>
    );
  }

  return <ServicePickerPane lab={lab} />;
}

function ServicePickerPane({ lab }: { readonly lab: EditableLab }) {
  const store = useLabEditor(lab);
  const activeNames = new Set(store.lab.services.map((s) => s.name));

  return (
    <div className="ide-scrollbar flex flex-col gap-sp-6 overflow-y-auto p-sp-4">
      {/* Preset grid */}
      <div className="flex flex-col gap-sp-2">
        <h3 className="text-ide-xs font-semibold text-foreground">Add Service</h3>
        <div className="grid grid-cols-3 gap-sp-2">
          {SERVICE_PRESETS.map((preset) => (
            <PresetCard
              key={preset.name}
              preset={preset}
              disabled={activeNames.has(preset.name)}
              onAdd={store.addService}
            />
          ))}
        </div>
      </div>

      {/* Active services */}
      {store.lab.services.length > 0 && (
        <div className="flex flex-col gap-sp-3">
          <h3 className="text-ide-xs font-semibold text-foreground">
            Active Services ({store.lab.services.length})
          </h3>
          {store.lab.services.map((svc) => (
            <ServiceRow
              key={svc.name}
              service={svc}
              onUpdate={store.updateService}
              onRemove={store.removeService}
            />
          ))}
        </div>
      )}
    </div>
  );
}
