// curl "https://www.sfu.ca/bin/wcm/course-outlines?2023/summer/cmpt"

const { default: axios } = require("axios");

const SPRING = "spring";
const SUMMER = "summer";
const FALL = "fall";

const CURRENT_TERM = SUMMER;
const CURRENT_YEAR = new Date().getFullYear();

let sfuDepartments = [];

const getSFUDepartments = async () => {
  if (sfuDepartments.length > 0) {
    return sfuDepartments;
  }

  sfuDepartments = (
    await axios.get(
      "https://www.sfu.ca/bin/wcm/course-outlines?current/current"
    )
  ).data.map(({ value }) => value);
  return sfuDepartments;
};

const generateCourseNameMatcher = async () => {
  return new RegExp(
    `(${(await getSFUDepartments()).join("|")})\\s*([1-9][0-9]{2})`
  );
};

const matchCourseString = async (text) => {
  const { source } = await generateCourseNameMatcher();
  return [...text.toLowerCase().matchAll(source)].map(
    ([_, department, courseNumber]) => ({
      department,
      courseNumber,
    })
  );
};

const generateTermWindow = (
  starting = [CURRENT_TERM, CURRENT_YEAR],
  maximumTerms = 12
) => {
  const window = [starting];

  let [term, year] = starting;
  for (let offset = 1; offset < maximumTerms; ++offset) {
    switch (term) {
      case SPRING:
        term = FALL;
        --year;
        break;
      case SUMMER:
        term = SPRING;
        break;
      case FALL:
        term = SUMMER;
    }

    window.push([term, year]);
  }

  return window;
};

const findLatestCourseSection = async (
  department = "cmpt",
  courseNumber = "130"
) => {
  const results = await Promise.all(
    generateTermWindow().map(async ([term, year]) => {
      const sections = await getCourseSections(
        year,
        term,
        department,
        courseNumber
      );
      return [term, year, sections];
    })
  );
  for (const [term, year, sections] of results) {
    if (sections.length > 0) {
      return { term, year, section: sections[0] };
    }
  }
  return { term, year, section: undefined };
};

const findLatestCourseOutline = async (
  department = "cmpt",
  courseNumber = "130"
) => {
  const { term, year, section } = await findLatestCourseSection(
    department,
    courseNumber
  );
  if (section) {
    const { value } = section;
    const outline = await getCourseOutline(
      year,
      term,
      department,
      courseNumber,
      value
    );
    return outline.data;
  }
  return {};
};

const getCourses = async (
  year = 2023,
  term = "summer",
  department = "cmpt"
) => {
  return axios.get(
    `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}`
  );
};

const getCourseSections = async (
  year = 2023,
  term = "summer",
  department = "cmpt",
  courseNumber = "999"
) => {
  try {
    console.log("hello");
    const response = await axios.get(
      `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}/${courseNumber}`
    );
    return response.data
      .filter(({ sectionCode }) => sectionCode === "LEC")
      .slice(0, 1);
  } catch (e) {
    return [];
  }
};

const getCourseOutline = async (
  year = 2023,
  term = "summer",
  department = "cmpt",
  courseNumber = "999",
  section = "d100"
) => {
  return axios.get(
    `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}/${courseNumber}/${section}`
  );
};

const generateCourseKey = (department = "cmpt", courseNumber = "999") =>
  `${department}.${courseNumber}`;

const extractCourseData = (courseKey = generateCourseKey("cmpt", "999")) => {
  const [department, courseNumber] = courseKey.split(".");
  return { department, courseNumber };
};

const getCourseRequirements = async (
  department = "cmpt",
  courseNumber = "999",
  mostRecentOfferings = new Map()
) => {
  const courseKey = generateCourseKey(department, courseNumber);
  if (mostRecentOfferings.has(courseKey)) {
    const { year, term } = mostRecentOfferings.get(courseKey);
  } else {
    mostRecentOfferings.set(courseKey, { year, term });
  }

  const sections = await getCourseSections();
};

const main = async () => {
  const x = await findLatestCourseOutline("cmpt", "307");
  const {
    info: { prerequisites, corequisites },
  } = x;
  console.log(x, prerequisites, corequisites);
  console.log(
    await matchCourseString(prerequisites),
    await matchCourseString(corequisites)
  );
  // const coursesAvailability = await Promise.all(
  //   [
  //     ["2022", "spring"],
  //     ["2022", "summer"],
  //     ["2022", "fall"],
  //     ["2023", "spring"],
  //     ["2023", "summer"],
  //   ]
  //     .reverse() // Later offerings should have more accurate requisite information
  //     .map(async ([year, term]) => {
  //       const courses = (await getCourses(year, term)).data;
  //       return [year, term, courses];
  //     })
  // );

  // const latestCourseOfferings = new Map();

  // coursesAvailability.forEach(([year, term, coursesData]) => {
  //   coursesData.forEach(({ value, title }) => {
  //     if (!latestCourseOfferings.has(value)) {
  //       latestCourseOfferings.set(value, { value, year, term });
  //     }
  //   });
  // });

  // latestCourseOfferings.forEach(async (offering) => {
  //   const { value, year, term } = offering;
  //   const sections = (
  //     await getCourseSections(year, term, "cmpt", value)
  //   ).data.filter(({ sectionCode }) => sectionCode === "LEC");

  //   if (sections.length > 0) {
  //     const courseSection = sections[0].value;
  //     const courseSectionData = (
  //       await getCourseOutline(year, term, "cmpt", value, courseSection)
  //     ).data;

  //     const { prerequisites, corequisites } = courseSectionData.info;

  //     const TODO_FIX_THIS = ["CMPT", "MATH", "MACM"];

  //     const requiredCourses = new Set(
  //       TODO_FIX_THIS.map((DEPT) => {
  //         // const matcher = /CMPT\s*[1-9][0-9]{2}/
  //         const matcher = new RegExp(`${DEPT}\\s*[1-9][0-9]{2}`);
  //         const required = [
  //           matcher.exec(prerequisites),
  //           matcher.exec(corequisites),
  //         ]
  //           .filter((x) => x !== null)
  //           .map((x) => x[0]);

  //         return required;
  //       }).flat()
  //     );

  //     console.log(value, year, term, requiredCourses);
  //   }
  // });
};

main();
