import { Button, Input, Label } from "@datam8/ui";
import type { Solution } from "./solution-types";

export type SolutionSettingsValues = Pick<Solution, "basePath" | "modelPath" | "pluginsPath" | "diagramPath" | "generatorTargets">;

export function SolutionSettingsFields({
  value,
  onChange,
}: {
  value: SolutionSettingsValues;
  onChange: (next: SolutionSettingsValues) => void;
}) {
  const update = (patch: Partial<SolutionSettingsValues>) => onChange({ ...value, ...patch });
  const updateTarget = (index: number, patch: Partial<Solution["generatorTargets"][number]>) => {
    update({ generatorTargets: value.generatorTargets.map((target, i) => i === index ? { ...target, ...patch } : target) });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingInput id="solution-base-path" label="Base path" value={value.basePath} onChange={(basePath) => update({ basePath })} />
        <SettingInput id="solution-model-path" label="Model path" value={value.modelPath} onChange={(modelPath) => update({ modelPath })} />
        <SettingInput id="solution-plugins-path" label="Plugins path" value={value.pluginsPath || ""} onChange={(pluginsPath) => update({ pluginsPath })} />
        <SettingInput id="solution-diagram-path" label="Diagram path (optional)" value={value.diagramPath || ""} onChange={(diagramPath) => update({ diagramPath })} />
      </div>

      <section className="space-y-3" aria-labelledby="generator-targets-title">
        <div className="flex items-center justify-between gap-3">
          <h3 id="generator-targets-title" className="text-sm font-semibold">Generator targets</h3>
          <Button
            type="button"
            variant="outline"
            onClick={() => update({
              generatorTargets: [...value.generatorTargets, {
                name: "target",
                isDefault: value.generatorTargets.length === 0,
                sourcePath: "generate",
                outputPath: "output",
              }],
            })}
          >
            Add target
          </Button>
        </div>
        {value.generatorTargets.map((target, index) => (
          <div key={`${index}-${target.name}`} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <SettingInput id={`solution-target-${index}-name`} label="Name" value={target.name} onChange={(name) => updateTarget(index, { name })} />
            <SettingInput id={`solution-target-${index}-source`} label="Source path" value={target.sourcePath} onChange={(sourcePath) => updateTarget(index, { sourcePath })} />
            <SettingInput id={`solution-target-${index}-output`} label="Output path" value={target.outputPath} onChange={(outputPath) => updateTarget(index, { outputPath })} />
            <div className="flex items-end justify-between gap-3">
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="solution-default-target"
                  checked={!!target.isDefault}
                  onChange={() => {
                    const generatorTargets = value.generatorTargets.map((item, i) => ({ ...item, isDefault: i === index }));
                    update({ generatorTargets });
                  }}
                />
                Default target
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={value.generatorTargets.length === 1}
                onClick={() => {
                  const generatorTargets = value.generatorTargets.filter((_, i) => i !== index);
                  if (!generatorTargets.some((item) => item.isDefault)) generatorTargets[0] = { ...generatorTargets[0], isDefault: true };
                  update({ generatorTargets });
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function SettingInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
