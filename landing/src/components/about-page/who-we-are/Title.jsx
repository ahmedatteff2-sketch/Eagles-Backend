import SecondaryHeading from "../../headings/SecondaryHeading";
import TertiaryHeading from "../../headings/TertiaryHeading";

function Title() {
  return (
    <div>
      <SecondaryHeading>من نحن</SecondaryHeading>
      <TertiaryHeading>  خبرة تصنع القوة</TertiaryHeading>
      <p className="font-medium text-gray-300 leading-8">
 ادارة أقوى........تدريب اذكى

  <br /><br />
  تأسس <span className=" font-semibold">إيچيل جيم</span> بهدف مساعدة الأفراد،
  خاصة في <span className=" font-semibold">بهبشين ومركز ناصر</span>، 
  على تحقيق أهدافهم في اللياقة البدنية من خلال برامج تدريب احترافية 
  ومعدات حديثة. نسعى دائمًا لتقديم بيئة مشجعة وصحية 
  تساعدك على الوصول إلى أفضل نسخة من نفسك جسديًا وذهنيًا.

  <br /><br />
  <span className="font-semibold">إيچيل جيم</span> أُسس على يد مدربين محترفين ذوي خبرة، ويوفر لك:

  <ul className="list-disc list-inside mt-4 space-y-2">
    <li>إشراف تدريبي احترافي لضمان أعلى دقة في تنفيذ التمارين.</li>
    <li>مجموعة متنوعة من الأجهزة الحديثة لدعم جميع مستويات التدريب.</li>
    <li>خطط تدريب مُخصصة تُحدَّث باستمرار بما يناسب تطوّر المتدرّب وهدفه الشخصي.</li>
    <li>أجواء رياضية آمنة ومحفّزة تجعل التمرين تجربة يومية ممتعة وفعّالة.</li>
  </ul>
</p>

    </div>
  );
}

export default Title;
