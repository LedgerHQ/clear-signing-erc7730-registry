import callData from "../../../../registry/paraswap/calldata-AugustusSwapper.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
const newMagicFunction = (foo: any) => foo;

export default function Page() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsedData = newMagicFunction(callData);
  return <pre>{JSON.stringify(parsedData, null, 2)}</pre>;
}
