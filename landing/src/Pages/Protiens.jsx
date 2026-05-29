
import { FaDumbbell, FaHeartbeat, FaAppleAlt } from "react-icons/fa";
import {
  GiWeightLiftingUp,
  GiBelt,
  GiKneePad,
  GiArmBandage,
} from "react-icons/gi";

const Protiens = () => {
  return (
    <section className="bg-gray-950 text-white py-24 px-6 text-center">
      <div className="max-w-5xl mx-auto mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-red mb-6">
          البروتين أساس القوة
        </h2>
        <p className="text-gray-300 text-lg leading-relaxed">
          البروتين هو العنصر الرئيسي لبناء جسم صحي ومتوازن. نحن في
          <span className="text-red-400 font-semibold"> الراء </span>
          نقدم لك أفضل أنواع البروتينات والمكملات الغذائية لتساعدك على تحقيق
          أهدافك الرياضية بأمان وفعالية.
        </p>
      </div>

      {/* النقاط الرئيسية */}
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto mb-20">
        {[
          {
            icon: (
              <FaDumbbell className="text-red text-4xl text-center mx-auto mb-4" />
            ),
            title: "بناء عضلات قوية",
            desc: "يساعد البروتين على تعزيز نمو العضلات وتسريع عملية الاستشفاء بعد التمارين.",
          },
          {
            icon: <FaHeartbeat className="text-red text-4xl mx-auto mb-4" />,
            title: "تحسين الأداء البدني",
            desc: "يرفع من مستوى الطاقة ويزيد من القدرة على التحمل خلال التمارين المكثفة.",
          },
          {
            icon: <FaAppleAlt className="text-red text-4xl mx-auto mb-4" />,
            title: "دعم النظام الغذائي",
            desc: "يساهم في توازن النظام الغذائي ويحافظ على صحة الجسم بشكل عام.",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:scale-105 transition-transform shadow-lg hover:shadow-red-400/20"
          >
            {item.icon}
            <h3 className="text-2xl font-semibold mb-3 text-red">{item.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* منتجات الجيم */}
      <h2 className="text-3xl md:text-4xl font-bold text-red mb-10">منتجات الجيم</h2>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {[
          {
            icon: <GiWeightLiftingUp className="text-red text-4xl mx-auto mb-4" />,
            title: "Straps – أحزمة رفع الأثقال",
            desc: "تساعدك على رفع أوزان أثقل بدون فقدان القبضة.",
          },
          {
            icon: <GiArmBandage  className="text-red text-4xl mx-auto mb-4" />,
            title: "Wrist Wraps – داعم المعصم",
            desc: "يوفّر ثباتًا عاليًا للمعصم أثناء التمارين الثقيلة.",
          },
          {
            icon: <GiKneePad className="text-red text-4xl mx-auto mb-4" />,
            title: "Knee Sleeves – داعم الركبة",
            desc: "يحافظ على استقرار الركبة ويمنع الإصابات.",
          },
          {
            icon: <GiBelt className="text-red text-4xl mx-auto mb-4" />,
            title: "حزام ظهر (Weightlifting Belt)",
            desc: "يمنحك حماية ودعمًا أكبر لأسفل الظهر أثناء الرفعات.",
          },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:scale-105 transition-transform shadow-lg hover:shadow-red-400/20"
          >
            {item.icon}
            <h3 className="text-2xl font-semibold mb-3 text-red">{item.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* الزر */}
      <div className="mt-16">
        <a
          href="https://red-eagle.store"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-red hover:bg-red text-white font-semibold px-10 py-4 rounded-full text-lg shadow-md hover:shadow-red-400/30 transition-all duration-300"
        >
          تفضل بزيارة متجرنا
        </a>
      </div>
    </section>
  );
};

export default Protiens;
