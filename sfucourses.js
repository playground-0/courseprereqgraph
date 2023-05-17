// curl "https://www.sfu.ca/bin/wcm/course-outlines?2023/summer/cmpt"

const { default: axios } = require("axios");

const SPRING = "spring";
const SUMMER = "summer";
const FALL = "fall";

const CURRENT_TERM = SUMMER;
const CURRENT_YEAR = new Date().getFullYear();

let sfuDepartments = [];

const generateCourseKey = (department = "cmpt", courseNumber = "999") =>
  `${department} ${courseNumber}`;

const extractCourseKey = (courseKey = generateCourseKey("cmpt", "999")) => {
  const [department, courseNumber] = courseKey.split(" ");
  return { department, courseNumber };
};

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
    `(${(await getSFUDepartments()).join("|")})\\s*([1-9][0-9]{2}w?)`
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

const matchCourseNumber = (text) => {
  const match = /([1-9][0-9]{2})w?/.exec(text);
  if (match) {
    return Number(match[1]);
  }
  return null;
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
  return { term: undefined, year: undefined, section: undefined };
};

const courseOutlines = new Map();

const findLatestCourseOutline = async (
  department = "cmpt",
  courseNumber = "130"
) => {
  const courseKey = generateCourseKey(department, courseNumber);
  if (courseOutlines.has(courseKey)) {
    return courseOutlines.get(courseKey);
  }

  const { term, year, section } = await findLatestCourseSection(
    department,
    courseNumber
  );

  if (section) {
    const { value } = section;
    const outline = (
      await getSectionedCourseOutline(
        year,
        term,
        department,
        courseNumber,
        value
      )
    ).data;
    courseOutlines.set(courseKey, outline);
    return outline;
  }

  courseOutlines.set(courseKey, false);
  return false;
};

const getDepartmentCourses = async (
  year = 2023,
  term = "summer",
  department = "cmpt"
) => {
  return (
    await axios.get(
      `https://www.sfu.ca/bin/wcm/course-outlines?${year}/${term}/${department}`
    )
  ).data.map(({ value }) => ({ department, courseNumber: value }));
};

const getCourseSections = async (
  year = 2023,
  term = "summer",
  department = "cmpt",
  courseNumber = "999"
) => {
  try {
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

const getSectionedCourseOutline = async (
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

const findCourseRequisites = async (
  department = "cmpt",
  courseNumber = "130"
) => {
  const outline = await findLatestCourseOutline(department, courseNumber);
  if (!outline) {
    return {
      prerequisites: [],
      corequisites: [],
    };
  }

  const {
    info: { prerequisites, corequisites },
  } = outline;

  return {
    prerequisites: await matchCourseString(prerequisites),
    corequisites: await matchCourseString(corequisites),
  };
};

const identifyDepartmentCourses = async (department = "cmpt", window = 12) => {
  const courses = (
    await Promise.all(
      (
        await generateTermWindow()
      ).map(
        async ([term, year]) => await getDepartmentCourses(year, term, "cmpt")
      )
    )
  ).flat();

  const courseMap = new Map();

  courses.forEach((offering) => {
    const { department, courseNumber } = offering;
    const key = generateCourseKey(department, courseNumber);
    if (!courseMap.has(key)) {
      courseMap.set(key, offering);
    }
  });

  const courseList = [...courseMap.values()];
  courseList.sort((a, b) => {
    // Reversed
    const { courseNumber: courseANumber } = a;
    const { courseNumber: courseBNumber } = b;

    return matchCourseNumber(courseBNumber) - matchCourseNumber(courseANumber);
  });
  return courseList;
};

const calculateRequirementsGraph = async (
  department,
  courseNumber,
  graph = new Map(),
  log = false,
  level = 0
) => {
  const courseKey = generateCourseKey(department, courseNumber);

  if (log) {
    console.log(`${" ".repeat(level)}Processing`, department, courseNumber);
  }

  if (graph.has(courseKey)) {
    // Skip
    return graph;
  }

  const { prerequisites, corequisites } = await findCourseRequisites(
    department,
    courseNumber
  );

  const processRequiredList = (list) => {
    return [
      ...new Set(
        list.map(
          ({ department: preDepartment, courseNumber: preCourseNumber }) =>
            generateCourseKey(preDepartment, preCourseNumber)
        )
      ),
    ];
  };
  const prerequisiteList = processRequiredList(prerequisites);
  const corequisiteList = processRequiredList(corequisites);

  graph.set(courseKey, {
    prerequisites: prerequisiteList,
    corequisites: corequisiteList,
  });

  for (const courseList of [prerequisiteList, corequisiteList]) {
    for (const reqCourseKey of courseList) {
      const { department: reqDepartment, courseNumber: reqCourseNumber } =
        extractCourseKey(reqCourseKey);
      await calculateRequirementsGraph(
        reqDepartment,
        reqCourseNumber,
        graph,
        log,
        level + 1
      );
    }
  }

  return graph;
};

const calculateDepartmentRequirementGraph = async (
  department = "cmpt",
  extraCourses = []
) => {
  const graph = new Map();
  const courses = (await identifyDepartmentCourses(department)).concat(
    extraCourses
  );

  for (const { department: courseDepartment, courseNumber } of courses) {
    await calculateRequirementsGraph(courseDepartment, courseNumber, graph);
  }
  return graph;
};

const main = async () => {
  const cmptRequirementGraph = await calculateDepartmentRequirementGraph(
    "cmpt",
    [{ department: "mse", courseNumber: "110" }]
  );

  [...cmptRequirementGraph.entries()].forEach(([key, value]) => {
    console.log(`> ${key}`);
    console.log(`  ${JSON.stringify(value, null, 4)}`);
    console.log("");
  });
};

main();
