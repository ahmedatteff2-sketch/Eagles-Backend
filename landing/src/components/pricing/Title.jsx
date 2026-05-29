import SecondaryHeading from "../headings/SecondaryHeading";
import TertiaryHeading from "../headings/TertiaryHeading";

function Title() {
  return (
    <div className="relative z-20 text-center">
      <SecondaryHeading>خطة الأسعار</SecondaryHeading>
      <TertiaryHeading>خطط أسعار حصرية</TertiaryHeading>
      <p className="mx-auto max-w-[50ch] font-medium text-gray-300">
        في <b>Eagle Gym</b>، نقدم لك أفضل الخطط لمساعدتك على الوصول إلى أهدافك
        اللياقية بطريقة منظمة وفعّالة.
      </p>
    </div>
  );
}

export default Title;
