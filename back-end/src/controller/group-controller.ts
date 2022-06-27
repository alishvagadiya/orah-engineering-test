import { NextFunction, Request, Response } from "express"
import { getRepository, getManager } from "typeorm"
import { Group } from "../entity/group.entity"
import { GroupStudent } from "../entity/group-student.entity"
import { StudentRollState } from "../entity/student-roll-state.entity"
import { CreateGroupInput, UpdateGroupInput } from "../interface/group.interface"
import { CreateGroupStudentInput } from "../interface/group-student.interface"
import { map } from "lodash"

export class GroupController {
  private groupRepository = getRepository(Group)
  private groupStudentRepository = getRepository(GroupStudent)
  private studentRollStateRepository = getRepository(StudentRollState)

  async allGroups(request: Request, response: Response, next: NextFunction) {
    const groupsResponse = await this.groupRepository.find()
    if (!groupsResponse) {
      return { status: 400, message: "Missing/Invalid Data" }
    }
    return groupsResponse
  }

  async getGroup(request: Request, response: Response, next: NextFunction) {
    const groupResponse = await this.groupRepository.findOne(request.body.id)
    if (!groupResponse) {
      return { status: 400, message: "Missing/Invalid Data" }
    }
    return groupResponse
  }

  async createGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request

    const createGroupInput: CreateGroupInput = {
      name: params.name,
      number_of_weeks: params.number_of_weeks,
      roll_states: params.roll_states,
      incidents: params.incidents,
      ltmt: params.ltmt,
    }
    const group = new Group()
    group.prepareToCreate(createGroupInput)

    const groupResponse = await this.groupRepository.save(group)
    if (!groupResponse) {
      return { status: 400, message: "Missing/Invalid Data" }
    }
    return groupResponse
  }

  async updateGroup(request: Request, response: Response, next: NextFunction) {
    const { body: params } = request

    return this.groupRepository.findOne(params.id).then(async (group) => {
      if (!group) {
        return { status: 204, message: "No Content Found" }
      }
      const updateGroupInput: UpdateGroupInput = {
        id: params.id,
        name: params.name,
        number_of_weeks: params.number_of_weeks,
        roll_states: params.roll_states,
        incidents: params.incidents,
        ltmt: params.ltmt,
      }
      group.prepareToUpdate(updateGroupInput)

      const updateResponse = await this.groupRepository.save(group)
      if (!updateResponse) {
        return { status: 400, message: "Missing/Invalid Data" }
      }
      return updateResponse
    })
  }

  async removeGroup(request: Request, response: Response, next: NextFunction) {
    let groupToRemove = await this.groupRepository.findOne(request.body.id)
    if (!groupToRemove) {
      return { status: 204, message: "No content Found" }
    }
    const removeResponse = await this.groupRepository.remove(groupToRemove)
    if (!removeResponse) {
      return { status: 400, message: "Missing/Invalid Data" }
    }
    return removeResponse
  }

  async groupStudentList(number_of_weeks: number, ltmt: string, incidents: number, roll_states: string) {
    let groupStudents = await this.studentRollStateRepository
      .createQueryBuilder("srs")
      .select("srs.student_id", "student_id")
      .addSelect("count(*)", "incident_count")
      .leftJoin("student", "s", "s.id = srs.student_id")
      .leftJoin("roll", "r", "r.id = srs.roll_id")
      .where(`srs.created_at > date('now', '` + -7 * number_of_weeks + ` days')`)
      .groupBy("srs.state")
      .having(`incident_count ` + ltmt + ` ` + incidents + ` and state = '` + roll_states + `'`)
      .getRawMany()
    return groupStudents
  }
  private async removeAllGroupStudent() {
    return await this.groupStudentRepository.clear()
  }

  private async addGroupStudent(groupStudentInput: CreateGroupStudentInput[], groupId: number) {
    const groupStudent: GroupStudent[] = map(groupStudentInput, (param) => {
      const createStudentRollStateInput: CreateGroupStudentInput = {
        group_id: groupId,
        student_id: param.student_id,
        incident_count: param.incident_count,
      }

      const groupStudent = new GroupStudent()
      groupStudent.prepareToCreate(createStudentRollStateInput)
      return groupStudent
    })
    return this.groupStudentRepository.save(groupStudent)
  }

  async runGroupFilters(request: Request, response: Response, next: NextFunction) {
    await this.removeAllGroupStudent()
    let allGroup = await this.groupRepository.find()
    if (!allGroup) {
      return { status: 204, message: "No data found" }
    }
    const groupStudent = map(allGroup, async (group) => {
      const groupStudents = await this.groupStudentList(group.number_of_weeks, group.ltmt, group.incidents, group.roll_states)
      if (groupStudents.length > 0) {
        const addResponse = await this.addGroupStudent(groupStudents, group.id)
        if (!addResponse) {
          return { status: 500, message: "Internal Server Error" }
        }
      }
      const run_at = new Date()
      const updateGroupInput: UpdateGroupInput = {
        id: group.id,
        name: group.name,
        number_of_weeks: group.number_of_weeks,
        roll_states: group.roll_states,
        incidents: group.incidents,
        ltmt: group.ltmt,
        run_at: run_at,
        student_count: groupStudents.length,
      }
      group.prepareToUpdate(updateGroupInput)

      const updateResponse = await this.groupRepository.save(group)
      if (!updateResponse) {
        return { status: 400, message: "Missing/Invalid Data" }
      }
      return updateResponse
    })
    if (groupStudent.length > 0) {
      return true
    } else {
      return false
    }
  }

  async getGroupStudents(request: Request, response: Response, next: NextFunction) {
    let groupStudents = await this.groupStudentRepository
      .createQueryBuilder("gs")
      .select("gs.student_id", "student_id")
      // .addSelect("gs.incident_count", "incident_count")
      .addSelect("s.first_name", "first_name")
      .addSelect("s.last_name", "last_name")
      .addSelect("s.first_name|| ' '|| s.last_name", "full_name")
      .leftJoin("student", "s", "s.id = gs.student_id")
      .where("gs.group_id = :groupId", { groupId: request.body.groupId })
      .getRawMany()
    return groupStudents
  }
}
