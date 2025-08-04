// tailwind.config.js
module.exports = {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }
  // tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      animation: {
        gradient: "gradientBG 10s ease infinite",
        fadeIn: "fadeIn 1.5s ease forwards",
        fadeInUp: "fadeInUp 1s ease-out forwards",
      },
      keyframes: {
        gradientBG: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(40px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
  
};
<h1 className="text-5xl font-extrabold animate-shimmer bg-gradient-to-r from-purple-300 via-pink-400 to-red-400 tracking-wider drop-shadow-md mb-2">
  Generalist
</h1>



  