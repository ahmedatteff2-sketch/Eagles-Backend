import img1 from "../../images/pricing/img1.webp";
import img2 from "../../images/pricing/img2.jpg";
import img3 from "../../images/pricing/img3.webp";

function Cards() {
  return (
    <div className="relative z-10 grid gap-8 xl:grid-cols-3 max-w-6xl mx-auto px-4 py-20 font-cairo">
      {/* Card 01 */}
      <div className="group relative flex flex-col bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
        <div className="relative overflow-hidden">
          <img
            src={img1}
            alt="المبتدئين"
            className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <h4 className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xl font-bold text-white bg-red/90 px-6 py-2 rounded-full">
          BASIC
          </h4>
        </div>
        <div className="flex flex-col items-center p-8 space-y-6">
          <h5 className="text-gray-400 text-xl">
            <span className="text-4xl font-bold text-black">175 جنيه</span> / شهر
          </h5>
          <ul className="space-y-3 text-gray-600 text-center">



            <li>  برنامج عام</li>
            <li> برنامج تدريبي ثابت</li>
          </ul>
      
        </div>
      </div>

      {/* Card 02 — مميزة */}
      <div className="group relative flex flex-col bg-gradient-to-b from-yellow-400 to-yellow-500 text-black rounded-3xl overflow-hidden shadow-2xl scale-105 hover:scale-110 transition-all duration-500 border-4 border-yellow-300">
        <div className="relative overflow-hidden">
          <img
            src={img2}
            alt="أساسي"
            className="w-full h-64 object-cover opacity-90 transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <h4 className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xl font-bold text-black bg-white/80 px-6 py-2 rounded-full">
          TRANSFORM
            BASIC
          </h4>
        </div>
        <div className="flex flex-col items-center p-8 space-y-6">
          <h5 className="text-black text-xl">
            <span className="text-4xl font-bold">210 جنيه</span> / شهر
          </h5>
          <ul className="space-y-3 text-black/80 text-center font-medium">


            <li>  برنامج تدريب حسب الهدف</li>
            <li>متابعة غذائية أسبوعية</li>
            <li>جلسة توجيه في بداية كل شهر</li>
            <li>خصم 20% على اشتراك اللوكر  </li>
            <li>خصم 20٪ على القهوه</li>
          </ul>

       
        </div>
        <div className="absolute top-3 right-3 bg-black text-white px-3 py-1 rounded-full text-sm font-bold">
          مميزة ⭐
        </div>
      </div>

      {/* Card 03 */}
      <div className="group relative flex flex-col bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
        <div className="relative overflow-hidden">
          <img
            src={img3}
            alt="متقدم"
            className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <h4 className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xl font-bold text-white bg-red/90 px-6 py-2 rounded-full">
          ELITE
          TRANSFORM
          </h4>
        </div>
        <div className="flex flex-col items-center p-8 space-y-6">
          <h5 className="text-gray-400 text-xl">
            <span className="text-4xl font-bold text-black">250 جنية</span> / شهر
          </h5>
          <ul className="space-y-3 text-gray-600 text-center">

         

            <li> مدرب شخصي </li>
            <li> نظام غذائي كامل شهري</li>
            <li> تقييم لياقة أسبوعي</li>
            <li>تواصل ومتابعة يومية</li>
            <li>قياس انبودي يدوي اسبوعي  </li>
            <li>خصم 50% على اللوكر</li>
            <li>خصم 50% على القهوة</li>
          </ul>
       
        </div>
      </div>
    </div>
  );
}

export default Cards;
