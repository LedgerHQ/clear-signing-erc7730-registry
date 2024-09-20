const Device = () => (
  <div className="h-[342px] w-[220px] rounded-xl rounded-l-none border-8 border-l-0 border-black bg-white"></div>
);

export const DevicesDemo = () => (
  <div className="flex w-fit space-x-10 bg-neutral-200 p-16">
    <Device />
    <Device />
    <Device />
    <Device />
  </div>
);
