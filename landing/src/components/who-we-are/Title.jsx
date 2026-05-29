import SecondaryHeading from "../headings/SecondaryHeading";
import TertiaryHeading from "../headings/TertiaryHeading";

function Title() {
  return (
    <>
      <SecondaryHeading>من نحن</SecondaryHeading>
      <TertiaryHeading>ارتقِ بصحتك وجسمك إلى المستوى التالي</TertiaryHeading>
      <p className="mb-14 font-medium text-gray-400">
        ارتقِ بصحتك وجسمك من خلال برنامجنا الشامل المصمم لمساعدتك على تحقيق أهدافك في اللياقة البدنية.
      </p>
    </>
  );
}

export default Title;
