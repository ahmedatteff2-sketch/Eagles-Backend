import progression from "../../images/who-we-are/progression.png";
import workout from "../../images/who-we-are/workout.png";
import nutritions from "../../images/who-we-are/nutritions.png";

const cardStyles =
  "relative z-10 flex flex-col items-center gap-4 overflow-hidden rounded-br-3xl rounded-tl-3xl bg-white bg-[url('./images/who-we-are/card-bg.webp')] bg-cover bg-center bg-no-repeat px-5 py-10 text-center shadow-2xl transition-all duration-300 before:absolute before:inset-0 before:z-[-1] before:bg-white before:transition-all before:duration-300 hover:text-white hover:before:bg-opacity-0";

function FeatureCards() {
  return (
    <div className="mt-[-50px] grid gap-14 2xl:grid-cols-3 2xl:gap-6">
      <div className={cardStyles}>
        <img src={progression} alt="progression" className="h-auto w-20" />
        <h5 className="text-2xl font-bold uppercase">التقدم</h5>
        <p className="font-medium">
          سيعمل فريق الخبراء لدينا معك لإنشاء خطة مخصصة تساعدك على تحقيق النجاح خطوة بخطوة.
        </p>
      </div>
      <div className={cardStyles}>
        <img src={workout} alt="workout" className="h-auto w-20" />
        <h5 className="text-2xl font-bold uppercase">التمارين</h5>
        <p className="font-medium">
          مع مجموعة متنوعة من التمارين للاختيار من بينها، ستحصل على كل ما تحتاجه للوصول إلى أفضل لياقة في حياتك.
        </p>
      </div>
      <div className={cardStyles}>
        <img src={nutritions} alt="nutritions" className="h-auto w-20" />
        <h5 className="text-2xl font-bold uppercase">التغذية</h5>
        <p className="font-medium">
          سيعمل فريقنا معك لإنشاء خطة وجبات شخصية تساعدك على الوصول إلى أهدافك الصحية المحددة.
        </p>
      </div>
    </div>
  );
}

export default FeatureCards;
