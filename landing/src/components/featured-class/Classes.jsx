const cardStyles = `relative h-72 w-full cursor-pointer overflow-hidden after:absolute after:left-[-25px] after:top-20 after:z-10 after:h-16 after:w-28 after:rotate-[30deg] after:rounded-r-full after:bg-white/30 after:bg-[length:40px] after:bg-[70%] after:bg-no-repeat after:transition-all hover:after:bg-white group`;

const bgStyles = `h-full w-full 
bg-cover bg-center grayscale transition-all duration-700 group-hover:scale-150 group-hover:grayscale-0`;

function Classes() {
  return (
    <div className="mt-12 grid grid-cols-1 gap-5 text-left 3xl:grid-cols-4" dir="rtl">
      {/* ركوب الدراجة */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/cycling-white.png')] hover:after:bg-[url('./images/featured-class/cycling-red.png')] 3xl:col-span-2`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/img2.jpg')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold"> الجري</h4>
        </div>
      </div>
  
      {/* الكاراتيه */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/karate-white.png')] hover:after:bg-[url('./images/featured-class/karate-red.png')]`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/karate.jpg')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold">الكاراتيه</h4>
       
        </div>
      </div>
  
      {/* رفع الأثقال */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/power-white.png')] hover:after:bg-[url('./images/featured-class/power-red.png')]`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/power.webp')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold">رفع الأثقال</h4>
        
        </div>
      </div>
  
      {/* التأمل */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/meditation-white.png')] hover:after:bg-[url('./images/featured-class/meditation-red.png')]`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/meditation.jpg')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold">التأمل</h4>
         
        </div>
      </div>
  
      {/* الفنون القتالية */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/martial-arts-white.png')] hover:after:bg-[url('./images/featured-class/martial-arts-red.png')]`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/martial-arts.webp')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold">الفنون القتالية</h4>
        
        </div>
      </div>
  
      {/* التمارين الرياضية */}
      <div
        className={`${cardStyles} after:bg-[url('./images/featured-class/workout-white.png')] hover:after:bg-[url('./images/featured-class/workout-red.png')] 3xl:col-span-2`}
      >
        <div
          className={`${bgStyles} bg-[url('./images/featured-class/workout.webp')]`}
        ></div>
        <div className="absolute bottom-0 z-10 mb-5 ml-5 cursor-text space-y-2 text-white">
          <h4 className="text-3xl font-bold">التمارين الرياضية</h4>
        </div>
      </div>
    </div>
  );
  
}

export default Classes;
