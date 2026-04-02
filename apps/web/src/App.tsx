import { AppShell } from "./app/AppShell";
import { GeneratorProvider } from "./features/generator/GeneratorContext";
import { ModelEditorProvider } from "./features/model/ModelEditorContext";
import { SolutionProvider } from "./features/solution/SolutionContext";
import { ConfirmProvider } from "./shared/hooks/useConfirm";
import { ErrorSurfaceProvider } from "./shared/ui/ErrorSurface";

export default function App() {
  return (
    <SolutionProvider>
      <ErrorSurfaceProvider>
        <ModelEditorProvider>
          <GeneratorProvider>
            <ConfirmProvider>
              <AppShell />
            </ConfirmProvider>
          </GeneratorProvider>
        </ModelEditorProvider>
      </ErrorSurfaceProvider>
    </SolutionProvider>
  );
}
