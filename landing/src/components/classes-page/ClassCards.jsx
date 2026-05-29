const iconStyles = `absolute top-5 z-10 cursor-pointer rounded-full bg-gray-300 bg-center bg-no-repeat p-12 shadow-xl transition-all duration-300 group-hover:bg-red`;

const cardStyles = `clip-path-hexagon before:clip-path-hexagon relative cursor-pointer bg-white px-6 py-28 shadow-2xl before:absolute before:right-full before:top-0 before:z-[-1] before:h-full before:w-full before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/cycling.webp')] before:bg-cover before:grayscale before:transition-all before:duration-300 group-hover:before:right-0`;

function ClassCards() {
  return (
    <section className="bg-gray-50 px-6 py-32 text-center" dir="ltr">
      <div className="container grid gap-10 lg:grid-cols-2 3xl:grid-cols-3">
        {/* ركوب الدراجات */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/cycling-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/img2.jpg')]`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              ركوب الدراجات
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              أفضل تدريب لياقة بدنية في المدينة مع برامج متنوعة ومتميزة
            </p>
          </div>
        </div>
  
        {/* التأمل */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/meditation-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/meditation.jpg')]`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              التأمل
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              امنح عقلك الراحة والصفاء من خلال جلسات تأمل موجهة
            </p>
          </div>
        </div>
  
        {/* فنون القتال */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/martial-arts-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/martial-arts.webp')]`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              فنون القتال
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              درّب نفسك على الدفاع عن النفس مع مدربين محترفين
            </p>
          </div>
        </div>
  
        {/* الكاراتيه */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/karate-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/karate.jpg')]`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              الكاراتيه
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              اكتسب القوة والانضباط من خلال دروس الكاراتيه المميزة
            </p>
          </div>
        </div>
  
        {/* رفع الأثقال */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/power-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/power.webp')]`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              رفع الأثقال
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              قم ببناء قوتك البدنية من خلال تدريبات رفع الأثقال المكثفة
            </p>
          </div>
        </div>
  
        {/* التمارين الرياضية */}
        <div className="clip-path-hexagon-fix group relative">
          <div
            className={`${iconStyles} bg-[url('./images/featured-class/workout-white.png')]`}
          ></div>
  
          <div
            className={`${cardStyles} before:bg-[linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url('./images/featured-class/workout.webp')] before:bg-right`}
          >
            <h3 className="mb-3 text-2xl font-bold transition-all group-hover:text-white">
              التمارين الرياضية
            </h3>
            <p className="font-medium text-gray-300 transition-all group-hover:text-white">
              حافظ على لياقتك ونشاطك مع مجموعة متنوعة من التمارين اليومية
            </p>
          </div>
        </div>
      </div>
    </section>
  );
  
}

export default ClassCards;
