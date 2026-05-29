import SecondaryHeading from "../headings/SecondaryHeading";
import TertiaryHeading from "../headings/TertiaryHeading";

function Title() {
  return (
    <div className="mb-10">
      <SecondaryHeading>لماذا تختارنا</SecondaryHeading>
      <TertiaryHeading color="white">
        يمكننا مساعدتك في الوصول إلى الشكل المثالي لجسمك!
      </TertiaryHeading>
      <p className="font-medium text-gray-200">
        في <b>Eagle Gym</b>، نحن ملتزمون بمساعدتك على تحقيق الجسم الذي تحلم به.
        يعمل مدربونا وخبراء التغذية معك لوضع خطة تدريب وتغذية شخصية تساعدك
        على تحقيق أهدافك الخاصة.
      </p>
    </div>
  );
}

export default Title;
