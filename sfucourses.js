// curl "https://www.sfu.ca/bin/wcm/course-outlines?2023/summer/cmpt"

const { default: axios } = require("axios");

const getCourses = async (
  year = "2023",
  term = "summer",
  department = "cmpt"
) => {
  return axios.get(
    `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}`
  );
};

const getCourseSections = async (
  year = "2023",
  term = "summer",
  department = "cmpt",
  courseNumber = "130"
) => {
  return axios.get(
    `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}/${courseNumber}`
  );
};

const getCourseOutline = async (
  year = "2023",
  term = "summer",
  department = "cmpt",
  courseNumber = "130",
  section = "d100"
) => {
  return axios.get(
    `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}/${courseNumber}/${section}`
  );
};

const main = async () => {
  const coursesAvailability = await Promise.all(
    [
      ["2022", "spring"],
      ["2022", "summer"],
      ["2022", "fall"],
      ["2023", "spring"],
      ["2023", "summer"],
    ]
      .reverse() // Later offerings should have more accurate requisite information
      .map(async ([year, term]) => {
        const courses = (await getCourses(year, term)).data;
        return [year, term, courses];
      })
  );

  const latestCourseOfferings = new Map();

  coursesAvailability.forEach(([year, term, coursesData]) => {
    coursesData.forEach(({ value, title }) => {
      if (!latestCourseOfferings.has(value)) {
        latestCourseOfferings.set(value, { value, year, term });
      }
    });
  });

  latestCourseOfferings.forEach(async (offering) => {
    const { value, year, term } = offering;
    const sections = (
      await getCourseSections(year, term, "cmpt", value)
    ).data.filter(({ sectionCode }) => sectionCode === "LEC");

    if (sections.length > 0) {
      const courseSection = sections[0].value;
      const courseSectionData = (
        await getCourseOutline(year, term, "cmpt", value, courseSection)
      ).data;

      const { prerequisites, corequisites } = courseSectionData.info;

      const TODO_FIX_THIS = ["CMPT", "MATH", "MACM"];

      const requiredCourses = TODO_FIX_THIS.map((DEPT) => {
        const matcher = /CMPT\s*[1-9][0-9]{2}/;
        const required = [
          matcher.exec(prerequisites),
          matcher.exec(corequisites),
        ]
          .filter((x) => x !== null)
          .map((x) => x[0]);

        return required;
      }).flat();

      console.log(value, year, term, requiredCourses);
    }
  });
};

main();
