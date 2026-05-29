import { useEffect, useState } from "react";

function calcBmi(weight, height) {
  const convertedHeight = height / 100;
  const bmi = (weight / convertedHeight ** 2).toFixed(1);
  return bmi;
}

function Calculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [status, setStatus] = useState("");
  const [bmi, setBmi] = useState(0);

  function handleWeight(e) {
    setWeight(+e.target.value);
  }

  function handleHeight(e) {
    setHeight(+e.target.value);
  }

  function handleSubmit(e) {
    e.preventDefault();

    setBmi(calcBmi(weight, height));
  }

  useEffect(
    function () {
      if (!bmi) return;

      if (bmi < 18.5) setStatus("Underweight");
      else if (bmi < 25) setStatus("Normal");
      else if (bmi < 30) setStatus("Overweight");
      else if (bmi > 30) setStatus("Obese");
    },
    [bmi],
  );

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
    <div className="flex gap-4">
      <input
        type="number"
        min={1}
        placeholder="الوزن / كغ"
        className="focus w-32 border-2 bg-transparent p-3 font-bold text-white placeholder:font-regular placeholder:text-gray-150 lg:w-40"
        value={weight || ""}
        onChange={handleWeight}
        required
      />
      <input
        type="number"
        min={1}
        placeholder="الطول / سم"
        className="focus w-32 border-2 bg-transparent p-3 font-bold text-white placeholder:font-regular placeholder:text-gray-150 lg:w-40"
        value={height || ""}
        onChange={handleHeight}
        required
      />
    </div>
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-0">
      <p className="font-medium text-white lg:basis-44">
        مؤشر كتلة الجسم: <span className="text-red">{bmi || ""}</span>
      </p>
      <p className="font-medium text-white">
        حالتك: <span className="text-red">{status}</span>
      </p>
    </div>
    <button className="focus bg-gray-500 px-6 py-3 font-bold uppercase text-white">
      احسب
    </button>
  </form>
  
  );
}

export default Calculator;
