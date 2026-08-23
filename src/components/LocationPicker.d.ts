export type PickedLocation = { latitude: number; longitude: number; label?: string };
export function LocationPicker(props: { value?: PickedLocation; onChange: (location: PickedLocation) => void }): React.JSX.Element;
