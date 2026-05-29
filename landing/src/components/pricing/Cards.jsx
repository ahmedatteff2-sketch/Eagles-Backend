import img1 from "../../images/pricing/img1.webp";
import img2 from "../../images/pricing/img2.jpg";
import img3 from "../../images/pricing/img3.webp";
import { useLandingContent } from "../../content/LandingContentContext";

// Fallback images for the first three plans when an admin hasn't uploaded one.
const FALLBACK_IMAGES = [img1, img2, img3];

function PlanCard({ plan, index }) {
  const image = plan.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

  if (plan.highlighted) {
    return (
      <div className="group relative flex flex-col bg-gradient-to-b from-yellow-400 to-yellow-500 text-black rounded-3xl overflow-hidden shadow-2xl scale-105 hover:scale-110 transition-all duration-500 border-4 border-yellow-300">
        <div className="relative overflow-hidden">
          <img
            src={image}
            alt={plan.badge}
            className="w-full h-64 object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <h4 className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xl font-bold text-black bg-white/80 px-6 py-2 rounded-full">
            {plan.badge}
          </h4>
        </div>
        <div className="flex flex-col items-center p-8 space-y-6">
          <h5 className="text-black text-xl">
            <span className="text-4xl font-bold">{plan.price}</span> / {plan.period}
          </h5>
          <ul className="space-y-3 text-black/80 text-center font-medium">
            {plan.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="absolute top-3 right-3 bg-black text-white px-3 py-1 rounded-full text-sm font-bold">
          مميزة ⭐
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
      <div className="relative overflow-hidden">
        <img
          src={image}
          alt={plan.badge}
          className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <h4 className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xl font-bold text-white bg-red/90 px-6 py-2 rounded-full">
          {plan.badge}
        </h4>
      </div>
      <div className="flex flex-col items-center p-8 space-y-6">
        <h5 className="text-gray-400 text-xl">
          <span className="text-4xl font-bold text-black">{plan.price}</span> / {plan.period}
        </h5>
        <ul className="space-y-3 text-gray-600 text-center">
          {plan.features.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Cards() {
  const { pricing } = useLandingContent();
  return (
    <div className="relative z-10 grid gap-8 xl:grid-cols-3 max-w-6xl mx-auto px-4 py-20 font-cairo">
      {pricing.plans.map((plan, i) => (
        <PlanCard key={i} plan={plan} index={i} />
      ))}
    </div>
  );
}

export default Cards;
