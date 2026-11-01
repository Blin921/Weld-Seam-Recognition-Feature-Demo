import CloudView from "../src/components/CloudView";
// The standalone build includes the renderer in its one local bundle.
export default function dynamic(..._args: unknown[]) {
  void _args;
  return CloudView;
}
