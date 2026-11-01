import RippleDistortion from "./RippleDistortion/RippleDistortion";

export function RippleDistortionHero() {
  return (
    <section className="relative h-screen min-h-[640px] w-full select-none overflow-hidden bg-[#071124]">
      <div className="absolute inset-0 w-full h-full">
        <RippleDistortion
          src="/login-package/assets/aistudio/The_City_Rises_by_Umberto_Boccioni_1910_c08f466e.webp"
          brushSize={150}
          strength={0.03}
          swirl={0.35}
          rings={1.75}
          spread={5}
          fade={3}
          spacing={1}
          clickStrength={2}
          dispersion={0.4}
          glint={0}
          tintAmount={0.1}
          tint="#a855f7"
          highlightColor="#ffffff"
          grayscale={false}
          trigger="hover"
          quality="low"
          enabled={true}
          className="w-full h-full"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[38vh]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.16) 28%, rgba(0, 0, 0, 0.64) 70%, #000 100%)",
        }}
      />
    </section>
  );
}

export default RippleDistortionHero;
