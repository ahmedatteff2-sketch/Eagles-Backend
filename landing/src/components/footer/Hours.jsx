function Hours() {
  return (
    <div className="space-y-8">
      {/* ساعات النساء */}
      <div className="space-y-5">
        <h4 className="relative pb-2 text-xl font-semibold capitalize before:absolute before:bottom-0 before:h-1 before:w-16 before:bg-red">
          النساء (سيدات فقط)
        </h4>
        <ul className="space-y-3 font-medium text-gray-300">
          <li>
            <span className="font-semibold">السبت – الأحد – الثلاثاء – الأربعاء: </span>
            10:00 صباحًا – 3:00 عصرًا
          </li>
          <li>
            <span className="font-semibold">الإثنين – الخميس: </span>
            10:00 صباحًا – 2:00 ظهرًا
          </li>
          <li>
            <span className="font-semibold">الجمعة: </span>
            2:00 عصرًا – 5:30 مساءً
          </li>
        </ul>
      </div>

      {/* ساعات الرجال */}
      <div className="space-y-5">
        <h4 className="relative pb-2 text-xl font-semibold capitalize before:absolute before:bottom-0 before:h-1 before:w-16 before:bg-red">
          الرجال (رجال فقط)
        </h4>
        <ul className="space-y-3 font-medium text-gray-300">
          <li>
            <span className="font-semibold">السبت – الأحد – الثلاثاء – الأربعاء: </span>
            4:00 عصرًا – 12:00 منتصف الليل
          </li>
          <li>
            <span className="font-semibold">الإثنين – الخميس: </span>
            3:00 عصرًا – 12:00 منتصف الليل
          </li>
          <li>
            <span className="font-semibold">الجمعة: </span>
            6:00 مساءً – 12:00 منتصف الليل
          </li>
        </ul>
      </div>
    </div>
  );
}

export default Hours;
